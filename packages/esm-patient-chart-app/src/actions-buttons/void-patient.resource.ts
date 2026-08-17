import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

export function voidPatient(patientUuid: string) {
  return openmrsFetch(`${restBaseUrl}/patient/${patientUuid}`, {
    method: 'DELETE',
  });
}

export function restorePatient(patientUuid: string) {
  return openmrsFetch(`${restBaseUrl}/patient/${patientUuid}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: { voided: false },
  });
}
