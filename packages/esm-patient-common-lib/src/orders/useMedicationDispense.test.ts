import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { openmrsFetch } from '@openmrs/esm-framework';
import { useMedicationDispense, useMedicationDispenses } from './useMedicationDispense';

const mockOpenmrsFetch = openmrsFetch as Mock;

function dispense(id: string, orderUuid: string, quantity: number) {
  return {
    resource: {
      resourceType: 'MedicationDispense',
      id,
      quantity: { value: quantity },
      authorizingPrescription: [{ reference: `MedicationRequest/${orderUuid}` }],
    },
  };
}

describe('useMedicationDispenses', () => {
  afterEach(() => mockOpenmrsFetch.mockReset());

  it('fetches the dispenses of all the orders in one request and groups them by order', async () => {
    mockOpenmrsFetch.mockResolvedValue({
      data: { entry: [dispense('d1', 'order-a', 10), dispense('d2', 'order-b', 5), dispense('d3', 'order-a', 2)] },
    });

    const { result } = renderHook(() => useMedicationDispenses(['order-b', 'order-a', 'order-c']));

    await waitFor(() => expect(result.current.dispensesByOrder).toBeDefined());
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
    expect(mockOpenmrsFetch.mock.calls[0][0]).toBe(
      '/ws/fhir2/R4/MedicationDispense?prescription=order-a,order-b,order-c&_count=100',
    );
    const { dispensesByOrder } = result.current;
    expect(dispensesByOrder.get('order-a').map((d) => d.id)).toEqual(['d1', 'd3']);
    expect(dispensesByOrder.get('order-b').map((d) => d.id)).toEqual(['d2']);
    expect(dispensesByOrder.get('order-c')).toEqual([]);
  });

  it('follows the next links, keeping them on the browser origin', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({
        data: {
          entry: [dispense('d1', 'order-a', 10)],
          link: [
            { relation: 'next', url: 'http://backend:8080/openmrs/ws/fhir2/R4?_getpages=abc&_getpagesoffset=100' },
          ],
        },
      })
      .mockResolvedValueOnce({ data: { entry: [dispense('d2', 'order-a', 4)] } });

    const { result } = renderHook(() => useMedicationDispense('order-a'));

    await waitFor(() => expect(result.current.quantityDispensed).toBe(14));
    expect(mockOpenmrsFetch.mock.calls[1][0]).toBe('/ws/fhir2/R4?_getpages=abc&_getpagesoffset=100');
  });

  it('does not fetch when there are no orders', () => {
    const { result } = renderHook(() => useMedicationDispenses([]));

    expect(result.current.dispensesByOrder).toBeUndefined();
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });
});
