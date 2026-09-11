import type { KeyedMutator } from 'swr';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

// UUID of the "Service" visit attribute type (FreeText, value = program UUID), provisioned as
// distro metadata (openmrs-distro-referenceapplication/configuration/attributetypes). Shared
// between esm-patient-chart-app's start-visit form (writes it) and esm-patient-programs-app's
// visit-ended listener (reads it), so it lives here rather than being duplicated in both apps.
export const SERVICE_VISIT_ATTRIBUTE_TYPE_UUID = '487b03fe-8034-4e95-ab67-bac9f2d7a27b';

export interface ProgramLocationRestriction {
  programUuid: string;
  allowedLocationUuids: Array<string>;
}

// Restricts a program to specific locations, keyed by program UUID -- mirrors
// filterFormsByLocation in esm-patient-forms-app/src/hooks/use-forms.ts, since OpenMRS
// Programs have no native location-restriction field.
//
// Shared between esm-patient-programs-app (the "Care Services" enrollment form, filtered by
// session location) and esm-patient-chart-app (the start-visit form's Service field, filtered
// by the visit location chosen in the form) so both apply the same restrictions.
export function filterProgramsByLocation<T extends { uuid: string }>(
  programs: Array<T> | undefined,
  programsLocationRestrictions: Array<ProgramLocationRestriction> | undefined,
  currentLocationUuid: string | undefined,
): Array<T> | undefined {
  if (!programsLocationRestrictions?.length) {
    return programs;
  }

  return programs?.filter((program) => {
    const restriction = programsLocationRestrictions.find((r) => r.programUuid === program.uuid);
    if (!restriction || !restriction.allowedLocationUuids?.length) {
      return true;
    }
    return Boolean(currentLocationUuid) && restriction.allowedLocationUuids.includes(currentLocationUuid);
  });
}

export interface ProgramEnrollmentPayload {
  program: string;
  patient: string;
  dateEnrolled: string | Date;
  dateCompleted: string | Date | null;
  location?: string;
  states?: Array<unknown>;
}

// Mirrors the targeted-invalidation style of invalidateVisitAndEncounterData /
// invalidateCurrentVisit in ../visit/revalidation-utils.ts, for the programenrollment cache.
export function invalidateProgramEnrollments(mutate: KeyedMutator<unknown>, patientUuid: string): void {
  mutate((key) => typeof key === 'string' && key.includes(`${restBaseUrl}/programenrollment?patient=${patientUuid}`));
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// The backend rejects a program enrollment whose dateCompleted is earlier than its dateEnrolled.
// A same-day enrollment can trip this purely from truncation (e.g. a date picker emitting
// midnight, or a short visit whose stop time rounds behind its start time) -- snap such values
// up to the enrollment instant instead of failing the save. Different-day and later-same-day
// values pass through unchanged.
export function normalizeProgramEnrollmentDates(
  dateEnrolled: Date | string | null,
  dateCompleted: Date | string | null,
): { dateEnrolled: string | null; dateCompleted: string | null } {
  const enrolledDate = dateEnrolled ? new Date(dateEnrolled) : null;
  const completedDate = dateCompleted ? new Date(dateCompleted) : null;

  const normalizedCompleted =
    completedDate && enrolledDate && isSameCalendarDay(completedDate, enrolledDate) && completedDate < enrolledDate
      ? enrolledDate
      : completedDate;

  return {
    dateEnrolled: enrolledDate ? enrolledDate.toISOString() : null,
    dateCompleted: normalizedCompleted ? normalizedCompleted.toISOString() : null,
  };
}

export function createProgramEnrollment(payload: ProgramEnrollmentPayload, abortController: AbortController) {
  if (!payload) {
    return null;
  }
  const { program, patient, dateEnrolled, dateCompleted, location, states } = payload;
  return openmrsFetch(`${restBaseUrl}/programenrollment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: { program, patient, dateEnrolled, dateCompleted, location, states },
    signal: abortController.signal,
  });
}
