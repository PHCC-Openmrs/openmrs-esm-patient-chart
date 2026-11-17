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
  authorizingPrescription?: Array<{ reference?: string }>;
}

interface MedicationDispenseResponse {
  entry?: Array<{ resource: MedicationDispense }>;
  total?: number;
  link?: Array<{ relation: string; url: string }>;
}

/** The server's fhir2.paging.maximum; it pages at 10 unless asked for more. */
const PAGE_SIZE = 100;

/**
 * The server writes its paging links as absolute URLs with the scheme and host it saw, which behind
 * the gateway need not be the browser's, so keep only the part after the FHIR base.
 */
function nextPageUrl(bundle: MedicationDispenseResponse | undefined): string | null {
  const next = bundle?.link?.find((link) => link.relation === 'next')?.url;
  const base = next?.indexOf(fhirBaseUrl) ?? -1;
  return base < 0 ? null : next.substring(base);
}

async function fetchDispensesByOrder(orderUuids: Array<string>): Promise<Map<string, Array<MedicationDispense>>> {
  const dispensesByOrder = new Map<string, Array<MedicationDispense>>(orderUuids.map((uuid) => [uuid, []]));
  let url = `${fhirBaseUrl}/MedicationDispense?prescription=${orderUuids.join(',')}&_count=${PAGE_SIZE}`;
  while (url) {
    const { data } = await openmrsFetch<MedicationDispenseResponse>(url);
    for (const { resource } of data?.entry ?? []) {
      for (const prescription of resource.authorizingPrescription ?? []) {
        dispensesByOrder.get(prescription.reference?.split('/').pop())?.push(resource);
      }
    }
    url = nextPageUrl(data);
  }
  return dispensesByOrder;
}

export function getQuantityDispensed(dispenses: Array<MedicationDispense>) {
  return dispenses.reduce((total, dispense) => total + (dispense.quantity?.value ?? 0), 0);
}

/**
 * Fetches the MedicationDispense records of several drug orders in one request (a table row each
 * used to make its own), keyed by order uuid. Orders with no dispenses map to an empty list.
 */
export function useMedicationDispenses(orderUuids: Array<string>) {
  const uuids = [...new Set(orderUuids.filter(Boolean))].sort().join(',');
  const { data, error, isLoading } = useSWR<Map<string, Array<MedicationDispense>>, Error>(
    uuids ? ['MedicationDispense', uuids] : null,
    ([, key]: [string, string]) => fetchDispensesByOrder(key.split(',')),
  );
  return { dispensesByOrder: data, error, isLoading };
}

/**
 * Fetches the MedicationDispense records associated with a drug order, so callers can
 * show how much of the ordered quantity has actually been dispensed so far.
 */
export function useMedicationDispense(orderUuid: string) {
  const { dispensesByOrder, error, isLoading } = useMedicationDispenses(orderUuid ? [orderUuid] : []);
  const dispenses = dispensesByOrder?.get(orderUuid) ?? [];

  return {
    dispenses,
    quantityDispensed: getQuantityDispensed(dispenses),
    error,
    isLoading,
  };
}
