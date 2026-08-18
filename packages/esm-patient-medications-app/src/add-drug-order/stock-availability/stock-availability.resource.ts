import useSWR from 'swr';
import { openmrsFetch, restBaseUrl, useSession } from '@openmrs/esm-framework';

interface StockQuantity {
  quantity: number;
  quantityUoM?: string;
}

async function fetchStockQuantityForDrug(drugUuid: string, locationUuid: string | undefined) {
  // Stock items are keyed by the drug they represent - find the stock item for this
  // drug before we can look up how much of it is on hand.
  const { data: stockItemData } = await openmrsFetch<{ results: Array<{ uuid: string }> }>(
    `${restBaseUrl}/stockmanagement/stockitem?drugUuid=${drugUuid}&v=custom:(uuid)&limit=1`,
  );
  const stockItemUuid = stockItemData.results?.[0]?.uuid;
  if (!stockItemUuid) {
    // No matching stock item - either the stock management module isn't installed,
    // or this drug simply isn't tracked as a stock item. Either way, there's nothing
    // to show.
    return null;
  }

  const params = new URLSearchParams({ v: 'default', stockItemUuid, groupBy: 'StockItemOnly' });
  if (locationUuid) {
    params.set('locationUuid', locationUuid);
  }
  const { data: inventoryData } = await openmrsFetch<{ results: Array<StockQuantity> }>(
    `${restBaseUrl}/stockmanagement/stockiteminventory?${params.toString()}`,
  );
  const result = inventoryData.results?.[0];
  return { quantity: result?.quantity ?? 0, quantityUoM: result?.quantityUoM };
}

/**
 * Looks up how much of a drug is currently on hand at the prescriber's own location,
 * for the "in stock" hint shown on the drug order form. Fails silently (returns
 * `stock: null`) rather than surfacing an error, since the stock management module
 * may not be installed on every deployment and this is a convenience hint, not a
 * required part of ordering.
 */
export function useStockQuantityForDrug(drugUuid: string | undefined) {
  const { sessionLocation } = useSession();
  const locationUuid = sessionLocation?.uuid;
  const key = drugUuid
    ? `${restBaseUrl}/stockmanagement/stockitem?drugAvailabilityFor=${drugUuid}:${locationUuid}`
    : null;
  const { data, isLoading, error } = useSWR(key, () => fetchStockQuantityForDrug(drugUuid as string, locationUuid), {
    shouldRetryOnError: false,
  });

  return {
    stock: data as StockQuantity | null,
    isLoading,
    error,
  };
}
