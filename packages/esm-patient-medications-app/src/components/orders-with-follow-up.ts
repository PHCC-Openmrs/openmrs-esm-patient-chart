import { type Order } from '@openmrs/esm-patient-common-lib';

/**
 * The uuids of the orders that a newer order has already renewed or revised.
 *
 * An order can be renewed or modified only once: the server refuses a second follow-up order
 * ("Order.cannot.have.more.than.one"). So a medication in this set can no longer be renewed or
 * modified; only the newer order that followed it can. A follow-up that was itself stopped or
 * discontinued afterwards still counts: the parent has been renewed or revised.
 */
export function getOrdersWithFollowUp(orders: ReadonlyArray<Order> | null | undefined): Set<string> {
  return new Set(
    (orders ?? [])
      .filter((order) => (order.action === 'RENEW' || order.action === 'REVISE') && order.previousOrder?.uuid)
      .map((order) => order.previousOrder.uuid),
  );
}
