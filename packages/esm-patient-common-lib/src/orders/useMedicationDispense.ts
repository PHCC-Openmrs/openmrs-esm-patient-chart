import useSWR from 'swr';
import { fhirBaseUrl, openmrsFetch } from '@openmrs/esm-framework';

export interface MedicationDispense {
  resourceType: 'MedicationDispense';
  id: string;
  status?: string;
  quantity?: {
    value?: number;
    unit?: string;
  };
  whenHandedOver?: string;
}

interface MedicationDispenseResponse {
  entry?: Array<{ resource: MedicationDispense }>;
  total?: number;
}

/**
 * Fetches the MedicationDispense records associated with a drug order, so callers can
 * show how much of the ordered quantity has actually been dispensed so far.
 */
export function useMedicationDispense(orderUuid: string) {
  const url = orderUuid ? `${fhirBaseUrl}/MedicationDispense?prescription=${orderUuid}` : null;

  const { data, error, isLoading } = useSWR<{ data: MedicationDispenseResponse }, Error>(url, openmrsFetch);

  const dispenses = data?.data?.entry?.map((entry) => entry.resource) ?? [];
  const quantityDispensed = dispenses.reduce((total, dispense) => total + (dispense.quantity?.value ?? 0), 0);

  return {
    dispenses,
    quantityDispensed,
    error,
    isLoading,
  };
}
