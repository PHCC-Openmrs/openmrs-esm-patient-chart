import { fhirBaseUrl, openmrsFetch } from '@openmrs/esm-framework';

// Only the part of a FHIR R4 Condition this check reads (the global `fhir` typings are older).
interface ConditionBundle {
  entry?: Array<{ resource?: { clinicalStatus?: { coding?: Array<{ code?: string }> } } }>;
}

const problemListCategory = 'http://terminology.hl7.org/CodeSystem/condition-category|problem-list-item';

/**
 * Whether the patient has at least one Active entry on their Diagnoses page - the problem-list
 * Conditions that esm-patient-conditions-app manages. Inactive (resolved) entries don't count.
 *
 * Fetched fresh rather than through SWR so the check always reflects a diagnosis the clinician
 * may have only just added before signing the order basket.
 */
export async function patientHasActiveDiagnosis(patientUuid: string): Promise<boolean> {
  const { data } = await openmrsFetch<ConditionBundle>(
    `${fhirBaseUrl}/Condition?patient=${patientUuid}&category=${problemListCategory}&_count=100`,
  );
  return (data?.entry ?? []).some((entry) =>
    entry.resource?.clinicalStatus?.coding?.some((coding) => coding.code === 'active'),
  );
}
