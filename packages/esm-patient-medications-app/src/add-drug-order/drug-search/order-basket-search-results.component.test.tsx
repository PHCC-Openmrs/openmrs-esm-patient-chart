import React from 'react';
import { vi, describe, expect, test, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  ExtensionSlot,
  UserHasAccess,
  getDefaultsFromConfigSchema,
  useConfig,
  useSession,
} from '@openmrs/esm-framework';
import { mockPatient } from 'tools';
import { mockDrugSearchResultApiData, mockSessionDataResponse } from '__mocks__';
import { _resetOrderBasketStore } from '@openmrs/esm-patient-common-lib/src/orders/store';
import { configSchema, type ConfigObject } from '../../config-schema';
import { useStockAvailabilityForDrugs } from '../stock-availability/stock-availability.resource';
import { useDrugSearch, useDrugTemplate } from './drug-search.resource';
import OrderBasketSearchResults from './order-basket-search-results.component';

const [aspirin81, aspirin162, aspirin325] = mockDrugSearchResultApiData;

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseSession = vi.mocked(useSession);
const mockExtensionSlot = vi.mocked(ExtensionSlot);
const mockUserHasAccess = vi.mocked(UserHasAccess);
const mockUseDrugSearch = vi.mocked(useDrugSearch);
const mockUseDrugTemplate = vi.mocked(useDrugTemplate);
const mockUseStockAvailabilityForDrugs = vi.mocked(useStockAvailabilityForDrugs);
const mockUseMedicationOrders = vi.fn();

vi.mock('./drug-search.resource', async () => ({
  ...((await vi.importActual('./drug-search.resource')) as object),
  useDrugSearch: vi.fn(),
  useDrugTemplate: vi.fn(),
}));

vi.mock('../stock-availability/stock-availability.resource', () => ({
  useStockAvailabilityForDrugs: vi.fn(),
}));

vi.mock('../../api', async () => ({
  ...((await vi.importActual('../../api')) as object),
  useMedicationOrders: () => mockUseMedicationOrders(),
}));

/** The map `useStockAvailabilityForDrugs` hands back: drug uuid -> quantity on hand here. */
function availability(entries: Array<[string, number | null]>) {
  return { availabilityByDrugUuid: new Map(entries), isLoading: false };
}

function renderSearchResults() {
  return render(
    <OrderBasketSearchResults
      patient={mockPatient}
      searchTerm="Aspirin"
      closeWorkspace={vi.fn()}
      openOrderForm={vi.fn()}
      focusAndClearSearchInput={vi.fn()}
      visit={null}
    />,
  );
}

describe('OrderBasketSearchResults stock availability filtering', () => {
  beforeEach(() => {
    _resetOrderBasketStore();
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema) as ConfigObject);
    mockUseSession.mockReturnValue(mockSessionDataResponse.data);
    mockExtensionSlot.mockImplementation(() => null);
    mockUserHasAccess.mockImplementation(({ children }) => <>{children}</>);
    mockUseDrugSearch.mockReturnValue({
      drugs: mockDrugSearchResultApiData,
      isLoading: false,
      error: null,
      isValidating: false,
      mutate: vi.fn(),
    });
    mockUseDrugTemplate.mockReturnValue({ templates: [], isLoading: false, error: null });
    mockUseMedicationOrders.mockReturnValue({
      futureOrders: [],
      activeOrders: [],
      pastOrders: [],
      error: null,
      isLoading: false,
      isValidating: false,
    });
  });

  test('lists only the drugs on hand at the session location', () => {
    mockUseStockAvailabilityForDrugs.mockReturnValue(
      availability([
        [aspirin81.uuid, 200],
        [aspirin162.uuid, 0],
        // No inventory row at all - not stocked here.
        [aspirin325.uuid, null],
      ]),
    );

    renderSearchResults();

    expect(screen.getByText(/Aspirin 81mg/i)).toBeInTheDocument();
    expect(screen.queryByText(/Aspirin 162.5mg/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Aspirin 325mg/i)).not.toBeInTheDocument();
    expect(screen.getByText(/1 results for "Aspirin"/i)).toBeInTheDocument();
  });

  test('says nothing matching the search is in stock at this location when every match is out of stock', () => {
    mockUseStockAvailabilityForDrugs.mockReturnValue(
      availability([
        [aspirin81.uuid, 0],
        [aspirin162.uuid, 0],
        [aspirin325.uuid, 0],
      ]),
    );

    renderSearchResults();

    expect(screen.getByText(/Nothing matching "Aspirin" is in stock at Inpatient Ward/i)).toBeInTheDocument();
    expect(screen.queryByText(/no results to display/i)).not.toBeInTheDocument();
  });

  test('keeps drugs whose stock lookup has not resolved', () => {
    // Absent from the map: still in flight, or the lookup failed.
    mockUseStockAvailabilityForDrugs.mockReturnValue(availability([[aspirin81.uuid, 200]]));

    renderSearchResults();

    expect(screen.getByText(/Aspirin 81mg/i)).toBeInTheDocument();
    expect(screen.getByText(/Aspirin 162.5mg/i)).toBeInTheDocument();
    expect(screen.getByText(/Aspirin 325mg/i)).toBeInTheDocument();
  });

  test('lists every match when the location has no dispensing stock to filter against', () => {
    mockUseStockAvailabilityForDrugs.mockReturnValue(
      availability([
        [aspirin81.uuid, null],
        [aspirin162.uuid, null],
        [aspirin325.uuid, null],
      ]),
    );

    renderSearchResults();

    expect(screen.getByText(/3 results for "Aspirin"/i)).toBeInTheDocument();
  });

  test('falls back to the plain empty state when the search itself matched nothing', () => {
    mockUseDrugSearch.mockReturnValue({
      drugs: [],
      isLoading: false,
      error: null,
      isValidating: false,
      mutate: vi.fn(),
    });
    mockUseStockAvailabilityForDrugs.mockReturnValue(availability([]));

    renderSearchResults();

    expect(screen.getByText(/no results to display for "Aspirin"/i)).toBeInTheDocument();
  });
});
