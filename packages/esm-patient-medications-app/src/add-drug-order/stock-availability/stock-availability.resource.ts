import useSWR from 'swr';
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

/**
 * Builds the query for a "what can this location actually dispense" inventory lookup,
 * behind the order form's stock hint.
 *
 * Uses dispenseLocationUuid rather than locationUuid: the ordering location itself often
 * isn't a stock-tracked party (e.g. an outpatient clinic), so a plain locationUuid lookup
 * resolves to no party and reads as 0 on hand. dispenseLocationUuid instead walks the
 * location's own tree for a "Main Pharmacy"/"Dispensary"-tagged party, matching how the
 * pharmacy dispensing screens resolve stock for a given location.
 *
 * dispenseAtLocation is required, not optional: without it the backend *adds* every
 * Main Pharmacy-tagged party org-wide to the ones found in this location's tree, and
 * since groupBy=StockItemOnly doesn't group by party, the quantities of unrelated
 * facilities get summed into one number. A prescriber at one facility would see that
 * facility's stock plus every other facility's - and then order against stock their
 * pharmacy can't dispense. With it set, the lookup reports the same on-hand figure the
 * dispensing screen will show for this location (see openmrs-esm-dispensing-app's
 * stock.resource, which queries with the same flag).
 *
 * `filter` narrows the lookup to one stock item (stockItemUuid) or one drug (drugUuid).
 */
function dispenseInventoryParams(filter: Record<string, string>, locationUuid: string | undefined) {
  const params = new URLSearchParams({
    v: 'default',
    groupBy: 'StockItemOnly',
    dispenseAtLocation: '1',
    ...filter,
  });
  if (locationUuid) {
    params.set('dispenseLocationUuid', locationUuid);
  }
  return params;
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

  // The ordering location's own dispensing stock, see dispenseInventoryParams above.
  const params = dispenseInventoryParams({ stockItemUuid }, locationUuid);
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
