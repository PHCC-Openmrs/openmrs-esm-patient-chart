import { type Order } from '@openmrs/esm-patient-common-lib';
import { describe, expect, it } from 'vitest';
import { getOrdersWithFollowUp } from './orders-with-follow-up';

const order = (uuid: string, action: string, previousOrderUuid?: string) =>
  ({ uuid, action, previousOrder: previousOrderUuid ? { uuid: previousOrderUuid } : null }) as unknown as Order;

describe('getOrdersWithFollowUp', () => {
  it('flags an order that a newer order renewed, but not the renewal itself', () => {
    const parent = order('parent', 'NEW');
    const child = order('child', 'RENEW', 'parent');

    const withFollowUp = getOrdersWithFollowUp([parent, child]);

    expect(withFollowUp.has('parent')).toBe(true);
    expect(withFollowUp.has('child')).toBe(false);
  });

  it('flags an order that a newer order revised', () => {
    expect(getOrdersWithFollowUp([order('old', 'NEW'), order('new', 'REVISE', 'old')]).has('old')).toBe(true);
  });

  it('does not flag the target of a discontinue, or orders with no follow-up', () => {
    const withFollowUp = getOrdersWithFollowUp([order('a', 'NEW'), order('b', 'NEW'), order('c', 'DISCONTINUE', 'a')]);
    expect(withFollowUp.size).toBe(0);
  });

  it('copes with no orders', () => {
    expect(getOrdersWithFollowUp(null).size).toBe(0);
    expect(getOrdersWithFollowUp(undefined).size).toBe(0);
  });
});
