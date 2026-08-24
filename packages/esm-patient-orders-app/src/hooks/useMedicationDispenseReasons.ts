import useSWR from 'swr';
import { useMemo } from 'react';
import { fhirBaseUrl, openmrsFetch, type FetchResponse } from '@openmrs/esm-framework';

interface Coding {
  code: string;
  display?: string;
}

interface MedicationDispenseEntry {
  resourceType: 'MedicationDispense';
  authorizingPrescription?: Array<{ reference: string }>;
  statusReasonCodeableConcept?: { coding?: Array<Coding>; text?: string };
  whenHandedOver?: string;
}

interface FhirBundle {
  entry?: Array<{ resource?: MedicationDispenseEntry & { resourceType: string } }>;
}

// esm-dispensing-app's "Close" action (declining a prescription) records its reason on a FHIR
// MedicationDispense resource's statusReasonCodeableConcept -- a separate resource from the
// Order itself, linked back to it via authorizingPrescription. This fetches those dispenses and
// maps each order's uuid to its most recent decline reason.
export function useMedicationDispenseReasons(patientUuid: string): Record<string, string> {
  const url = patientUuid
    ? `${fhirBaseUrl}/MedicationRequest?patient=${patientUuid}&_revinclude=MedicationDispense:prescription`
    : null;

  const { data } = useSWR<FetchResponse<FhirBundle>>(url, openmrsFetch);

  return useMemo(() => {
    const dispensesByOrderUuid: Record<string, MedicationDispenseEntry> = {};

    data?.data?.entry?.forEach((entry) => {
      const resource = entry.resource;
      if (resource?.resourceType !== 'MedicationDispense') {
        return;
      }
      const orderUuid = resource.authorizingPrescription?.[0]?.reference?.replace('MedicationRequest/', '');
      if (!orderUuid) {
        return;
      }
      const existing = dispensesByOrderUuid[orderUuid];
      if (!existing || (resource.whenHandedOver ?? '') > (existing.whenHandedOver ?? '')) {
        dispensesByOrderUuid[orderUuid] = resource;
      }
    });

    const reasonsByOrderUuid: Record<string, string> = {};
    Object.entries(dispensesByOrderUuid).forEach(([orderUuid, dispense]) => {
      const concept = dispense.statusReasonCodeableConcept;
      const reason = concept?.coding?.[0]?.display || concept?.coding?.[0]?.code || concept?.text;
      if (reason) {
        reasonsByOrderUuid[orderUuid] = reason;
      }
    });
    return reasonsByOrderUuid;
  }, [data]);
}
