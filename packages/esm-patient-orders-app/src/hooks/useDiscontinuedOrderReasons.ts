import useSWR from 'swr';
import { useMemo } from 'react';
import { openmrsFetch, restBaseUrl, type FetchResponse } from '@openmrs/esm-framework';
import {
  careSettingUuid,
  orderCustomRepresentation,
  type Order,
  type PatientOrderFetchResponse,
} from '@openmrs/esm-patient-common-lib';

// Cancelling an order (via "Cancel order") doesn't modify the original order -- it creates a
// separate DISCONTINUE order pointing back at it via `previousOrder`, and that's where the
// reason typed in the cancel prompt is actually stored. usePatientOrders always fetches with
// excludeDiscontinueOrders=true, so those orders (and the reason on them) never show up there.
// This fetches them directly and maps previousOrder uuid -> reason so the original order's row
// can look its cancellation reason up.
export function useDiscontinuedOrderReasons(patientUuid: string): Record<string, string> {
  const url = patientUuid
    ? `${restBaseUrl}/order?patient=${patientUuid}&careSetting=${careSettingUuid}&v=${orderCustomRepresentation}&status=any`
    : null;

  const { data } = useSWR<FetchResponse<PatientOrderFetchResponse>>(url, openmrsFetch);

  return useMemo(() => {
    const reasonsByPreviousOrderUuid: Record<string, string> = {};
    data?.data?.results?.forEach((order: Order) => {
      if (order.action === 'DISCONTINUE' && order.previousOrder?.uuid) {
        const reason = order.orderReasonNonCoded || order.orderReason;
        if (reason) {
          reasonsByPreviousOrderUuid[order.previousOrder.uuid] = reason;
        }
      }
    });
    return reasonsByPreviousOrderUuid;
  }, [data]);
}
