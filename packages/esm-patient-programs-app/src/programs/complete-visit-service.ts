import { mutate } from 'swr';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { SERVICE_VISIT_ATTRIBUTE_TYPE_UUID, normalizeProgramEnrollmentDates } from '@openmrs/esm-patient-common-lib';
import { customRepresentation, updateProgramEnrollment } from './programs.resource';
import type { PatientProgram } from '../types';

const visitCustomRepresentation = 'custom:(uuid,stopDatetime,patient:(uuid),attributes:(value,attributeType:(uuid)))';

interface VisitForServiceCompletion {
  uuid: string;
  stopDatetime: string | null;
  patient: { uuid: string };
  attributes: Array<{ value: string; attributeType: { uuid: string } }>;
}

/**
 * When a visit ends, completes the program enrollment(s) that the start-visit form created for
 * it (see esm-patient-chart-app's start-visit form, which enrolls the patient in each of the
 * visit's "Service" selections the moment the visit starts). Fired from a `visit-ended` window
 * event -- the same convention esm-service-queues-app uses to reconcile queue entries after a
 * visit ends -- rather than a cross-app import, since this app is loaded independently of the
 * chart app.
 *
 * A visit with no "Service" attribute (created before this feature, or by another app) is left
 * untouched: this only completes episodes that the start-visit form itself opened.
 */
export async function completeVisitServiceEnrollment(visitUuid: string): Promise<void> {
  try {
    if (!visitUuid) {
      return;
    }

    const { data: visit } = await openmrsFetch<VisitForServiceCompletion>(
      `${restBaseUrl}/visit/${visitUuid}?v=${visitCustomRepresentation}`,
    );

    const serviceAttribute = visit?.attributes?.find(
      (attribute) => attribute.attributeType?.uuid === SERVICE_VISIT_ATTRIBUTE_TYPE_UUID,
    );
    // The Service attribute type allows only one occurrence, so multiple services selected at
    // visit start are stored as a single comma-separated value (see exported-visit-form.workspace.tsx).
    const programUuids = serviceAttribute?.value ? serviceAttribute.value.split(',').filter(Boolean) : [];

    if (!programUuids.length || !visit?.patient?.uuid) {
      return;
    }

    const { data } = await openmrsFetch<{ results: Array<PatientProgram> }>(
      `${restBaseUrl}/programenrollment?patient=${visit.patient.uuid}&v=${customRepresentation}`,
    );

    const enrollments = data?.results ?? [];

    await Promise.all(
      programUuids.map(async (programUuid) => {
        const activeEnrollments = enrollments.filter(
          (enrollment) => !enrollment.dateCompleted && enrollment.program?.uuid === programUuid,
        );

        if (!activeEnrollments.length) {
          return;
        }

        // Complete the episode this visit opened for this program -- if more than one is
        // somehow open (e.g. after a manual edit in Care Services), that can only be the most
        // recently enrolled one.
        const enrollmentToComplete = activeEnrollments.sort(
          (a, b) => new Date(b.dateEnrolled).getTime() - new Date(a.dateEnrolled).getTime(),
        )[0];

        const { dateEnrolled, dateCompleted } = normalizeProgramEnrollmentDates(
          enrollmentToComplete.dateEnrolled,
          visit.stopDatetime ?? new Date(),
        );

        return updateProgramEnrollment(
          enrollmentToComplete.uuid,
          {
            dateEnrolled,
            dateCompleted,
            location: enrollmentToComplete.location?.uuid,
            states: [],
          },
          new AbortController(),
        );
      }),
    );

    await mutate((key) => typeof key === 'string' && key.includes(`${restBaseUrl}/programenrollment`));
  } catch (error) {
    // The visit is already ended and must not be reopened over an enrollment-completion failure;
    // surface the error for diagnostics only.
    console.error('Failed to complete the visit service enrollment(s) after visit ended', error);
  }
}
