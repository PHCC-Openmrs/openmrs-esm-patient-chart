import { describe, expect, it } from 'vitest';
import { getOrderErrorMessage, isOrderAlreadyStoppedError } from './order-errors';

describe('order save errors', () => {
  const stoppedError = Object.assign(new Error('Server responded with 500 (Internal Server Error)'), {
    responseBody: { error: { message: 'Cannot stop an order that is already stopped, expired or voided' } },
  });

  it("reads the server's own message in preference to the generic one", () => {
    expect(getOrderErrorMessage(stoppedError)).toBe('Cannot stop an order that is already stopped, expired or voided');
    expect(getOrderErrorMessage(new Error('Network down'))).toBe('Network down');
    expect(getOrderErrorMessage(undefined)).toBeUndefined();
  });

  it('recognises an order that was already revised or stopped', () => {
    expect(isOrderAlreadyStoppedError(stoppedError)).toBe(true);
    expect(isOrderAlreadyStoppedError(new Error('Network down'))).toBe(false);
  });
});
