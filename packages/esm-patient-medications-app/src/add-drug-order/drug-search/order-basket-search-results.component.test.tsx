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
import { useDrugSearch, useDrugTemplate } from './drug-search.resource';
import OrderBasketSearchResults from './order-basket-search-results.component';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseSession = vi.mocked(useSession);
const mockExtensionSlot = vi.mocked(ExtensionSlot);
const mockUserHasAccess = vi.mocked(UserHasAccess);
const mockUseDrugSearch = vi.mocked(useDrugSearch);
const mockUseDrugTemplate = vi.mocked(useDrugTemplate);
const mockUseMedicationOrders = vi.fn();

vi.mock('./drug-search.resource', async () => ({
  ...((await vi.importActual('./drug-search.resource')) as object),
  useDrugSearch: vi.fn(),
  useDrugTemplate: vi.fn(),
}));

vi.mock('../../api', async () => ({
  ...((await vi.importActual('../../api')) as object),
  useMedicationOrders: () => mockUseMedicationOrders(),
}));

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

describe('OrderBasketSearchResults', () => {
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

  test('lists every drug the search matches, regardless of stock on hand', () => {
    renderSearchResults();

    expect(screen.getByText(/Aspirin 81mg/i)).toBeInTheDocument();
    expect(screen.getByText(/Aspirin 162.5mg/i)).toBeInTheDocument();
    expect(screen.getByText(/Aspirin 325mg/i)).toBeInTheDocument();
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

    renderSearchResults();

    expect(screen.getByText(/no results to display for "Aspirin"/i)).toBeInTheDocument();
  });
});
