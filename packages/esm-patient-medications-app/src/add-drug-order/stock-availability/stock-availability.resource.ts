import { useMemo } from 'react';
import useSWR from 'swr';
import useSWRImmutable from 'swr/immutable';
import { openmrsFetch, restBaseUrl, useSession } from '@openmrs/esm-framework';

interface StockQuantity {
  quantity: number;
  quantityUoM?: string;
  // How many dispensing units (see dispensingUnitName below) make up one quantityUoM -
  // e.g. 30 if quantityUoM is "Box" and the dispensing unit is "Tablet". Lets the "in
  // stock" hint be converted from the bulk packaging unit into the dispensing unit.
  quantityFactor?: number;
  // The stock item's configured dispensing unit (e.g. "Tablet") - the unit prescribers
  // should be dosing in, as opposed to quantityUoM above (the bulk packaging unit stock
  // operations record quantity in, e.g. "Box"). Used to lock the order form's Dose unit
  // field to what pharmacy actually dispenses in, see drug-order-form.component.tsx.
  dispensingUnitName?: string;
}

async function fetchStockQuantityForDrug(drugUuid: string, locationUuid: string | undefined) {
  // Stock items are keyed by the drug they represent - find the stock item for this
  // drug before we can look up how much of it is on hand.
  //
  // Uses v=default rather than a custom representation - this module's stockitem REST
  // resource doesn't honor arbitrary custom representations like v=custom:(uuid); it
  // silently returns near-empty objects (missing even `uuid`) instead of erroring, so
  // the lookup would always look like "no matching stock item" even when one exists.
  const { data: stockItemData } = await openmrsFetch<{
    results: Array<{ uuid: string; dispensingUnitName?: string }>;
  }>(`${restBaseUrl}/stockmanagement/stockitem?drugUuid=${drugUuid}&v=default&limit=1`);
  const stockItem = stockItemData.results?.[0];
  const stockItemUuid = stockItem?.uuid;
  if (!stockItemUuid) {
    // No matching stock item - treated the same as a stock item with 0 on hand, so a
    // drug that isn't tracked in stock management reads as "out of stock" rather than
    // silently showing nothing, which was easy to mistake for the feature not working.
    return { quantity: 0, quantityUoM: undefined, dispensingUnitName: undefined };
  }

  // Uses dispenseLocationUuid rather than locationUuid: the ordering location itself often
  // isn't a stock-tracked party (e.g. an outpatient clinic), so a plain locationUuid lookup
  // resolves to no party and reads as 0 on hand. dispenseLocationUuid instead walks up the
  // location's tree for a "Main Pharmacy"/"Dispensary"-tagged party (falling back to any
  // Main Pharmacy location org-wide), matching how the pharmacy dispensing screens resolve
  // stock for a given location.
  const params = new URLSearchParams({ v: 'default', stockItemUuid, groupBy: 'StockItemOnly' });
  if (locationUuid) {
    params.set('dispenseLocationUuid', locationUuid);
  }
  const { data: inventoryData } = await openmrsFetch<{ results: Array<StockQuantity> }>(
    `${restBaseUrl}/stockmanagement/stockiteminventory?${params.toString()}`,
  );
  const result = inventoryData.results?.[0];
  return {
    quantity: result?.quantity ?? 0,
    quantityUoM: result?.quantityUoM,
    quantityFactor: result?.quantityFactor,
    dispensingUnitName: stockItem.dispensingUnitName,
  };
}

/**
 * Looks up how much of a drug is currently on hand at the prescriber's own location,
 * for the "in stock" hint shown on the drug order form. A drug with no tracked stock
 * item, or no inventory record, reads as 0 (out of stock) rather than showing nothing.
 * Only a genuine fetch error (e.g. the stock management module isn't installed on this
 * deployment) suppresses the hint entirely, via `stock: null` - see the component.
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

// `null` means "couldn't be determined" (e.g. stock management isn't installed on this
// deployment, or the request failed) - callers should treat that the same as "exists",
// since we can't tell the drug apart from one that's simply untracked-but-present.
async function stockItemExistsForDrug(drugUuid: string): Promise<boolean | null> {
  try {
    // v=default, not a custom representation - see the note in fetchStockQuantityForDrug
    // above about this resource silently returning near-empty results otherwise.
    const { data } = await openmrsFetch<{ results: Array<{ uuid: string }> }>(
      `${restBaseUrl}/stockmanagement/stockitem?drugUuid=${drugUuid}&v=default&limit=1`,
    );
    return (data.results?.length ?? 0) > 0;
  } catch {
    return null;
  }
}

/**
 * Looks up, for each of the given drug UUIDs, whether a Stock Management stock item is
 * registered for it at all - a drug can have zero units on hand and still count as
 * "exists". Used to keep the drug search from listing/offering drugs that were never
 * added to Stock Management in the first place.
 */
export function useStockItemsExistForDrugs(drugUuids: Array<string>) {
  const sortedUuids = useMemo(() => [...(drugUuids ?? [])].sort(), [drugUuids]);
  const cacheKey = sortedUuids.length ? ['stock-item-exists-for-drugs', ...sortedUuids] : null;

  // Immutable: which drug a stock item represents doesn't change while the workspace is
  // open, so there's nothing to gain from revalidating on focus/reconnect - and each
  // revalidation costs one request per drug (this module's stockitem resource only
  // accepts a single drugUuid per request).
  const { data, isLoading } = useSWRImmutable(cacheKey, async () => {
    const entries = await Promise.all(
      sortedUuids.map(async (uuid) => [uuid, await stockItemExistsForDrug(uuid)] as const),
    );
    return new Map(entries);
  });

  return {
    stockItemExistsByDrugUuid: data ?? emptyStockItemExistence,
    isLoading,
  };
}

// Stable reference so callers memoizing on the returned map don't recompute every render
// while the lookup is still in flight.
const emptyStockItemExistence: ReadonlyMap<string, boolean | null> = new Map();
