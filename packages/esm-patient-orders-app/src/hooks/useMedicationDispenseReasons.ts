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
  status?: string;
  quantity?: { value?: number; unit?: string };
  whenHandedOver?: string;
}

interface MedicationRequestEntry {
  resourceType: 'MedicationRequest';
  id?: string;
  dispenseRequest?: { quantity?: { value?: number; unit?: string } };
}

interface FhirBundle {
  entry?: Array<{ resource?: MedicationDispenseEntry | MedicationRequestEntry }>;
}

// FHIR searches return 10 results per page by default, which would leave out a patient's newer orders.
const dispensesUrl = (patientUuid: string) =>
  patientUuid
    ? `${fhirBaseUrl}/MedicationRequest?patient=${patientUuid}&_revinclude=MedicationDispense:prescription&_count=100`
    : null;

// esm-dispensing-app's "Close" action (declining a prescription) records its reason on a FHIR
// MedicationDispense resource's statusReasonCodeableConcept -- a separate resource from the
// Order itself, linked back to it via authorizingPrescription. This fetches those dispenses and
// maps each order's uuid to its most recent decline reason.
export function useMedicationDispenseReasons(patientUuid: string): Record<string, string> {
  const { data } = useSWR<FetchResponse<FhirBundle>>(dispensesUrl(patientUuid), openmrsFetch);

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

export interface DispensedQuantity {
  /** Quantity of the order that was actually handed out (completed dispenses only). */
  quantity: number;
  /** Quantity that was ordered, when known. */
  ordered?: number;
  unit?: string;
}

// A prescription can be closed or put on hold after only part of it was dispensed. The order then
// carries a single DECLINED/ON_HOLD status, so the quantity that really was handed out (completed
// dispenses only), and the quantity ordered, are read from the FHIR records to let the caller show
// the dispensed part as completed and the remainder as declined/on hold.
export function useCompletedDispenseQuantities(patientUuid: string): Record<string, DispensedQuantity> {
  const { data } = useSWR<FetchResponse<FhirBundle>>(dispensesUrl(patientUuid), openmrsFetch);

  return useMemo(() => {
    const byOrderUuid: Record<string, DispensedQuantity> = {};
    const orderedByOrderUuid: Record<string, number> = {};
    data?.data?.entry?.forEach((entry) => {
      const resource = entry.resource;
      if (resource?.resourceType === 'MedicationRequest') {
        const ordered = resource.dispenseRequest?.quantity?.value;
        if (resource.id && ordered != null) {
          orderedByOrderUuid[resource.id] = ordered;
        }
        return;
      }
      if (resource?.resourceType !== 'MedicationDispense' || resource.status !== 'completed') {
        return;
      }
      const orderUuid = resource.authorizingPrescription?.[0]?.reference?.replace('MedicationRequest/', '');
      const quantity = resource.quantity?.value ?? 0;
      if (!orderUuid || quantity <= 0) {
        return;
      }
      const existing = byOrderUuid[orderUuid];
      byOrderUuid[orderUuid] = {
        quantity: (existing?.quantity ?? 0) + quantity,
        unit: existing?.unit ?? resource.quantity?.unit,
      };
    });
    Object.keys(byOrderUuid).forEach((orderUuid) => {
      byOrderUuid[orderUuid].ordered = orderedByOrderUuid[orderUuid];
    });
    return byOrderUuid;
  }, [data]);
}
