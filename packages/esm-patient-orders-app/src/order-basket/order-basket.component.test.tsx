import React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type LayoutType, showModal, useSession, useConfig, useLayoutType } from '@openmrs/esm-framework';
import { useOrderBasket, useMutatePatientOrders, postOrdersOnNewEncounter } from '@openmrs/esm-patient-common-lib';
import { mockSessionDataResponse } from '__mocks__';
import { useOrderEncounterForSystemWithVisitDisabled, useProviders } from '../api/api';
import { patientHasActiveDiagnosis } from '../api/diagnoses.resource';
import OrderBasket from './order-basket.component';

const mockUseSession = vi.mocked(useSession);
const mockUseConfig = vi.mocked(useConfig);
const mockUseLayoutType = vi.mocked(useLayoutType);
const mockUseOrderBasket = vi.mocked(useOrderBasket);
const mockUseMutatePatientOrders = vi.mocked(useMutatePatientOrders);
const mockUseOrderEncounterForSystemWithVisitDisabled = vi.mocked(useOrderEncounterForSystemWithVisitDisabled);
const mockUseProviders = vi.mocked(useProviders);
const mockPatientHasActiveDiagnosis = vi.mocked(patientHasActiveDiagnosis);
const mockPostOrdersOnNewEncounter = vi.mocked(postOrdersOnNewEncounter);
const mockShowModal = vi.mocked(showModal);

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...((await vi.importActual('@openmrs/esm-patient-common-lib')) as object),
  useOrderBasket: vi.fn(),
  useMutatePatientOrders: vi.fn(),
  postOrdersOnNewEncounter: vi.fn(),
  showOrderSuccessToast: vi.fn(),
}));

vi.mock('../api/diagnoses.resource', () => ({
  patientHasActiveDiagnosis: vi.fn(),
}));

vi.mock('../api/api', () => ({
  useOrderEncounterForSystemWithVisitDisabled: vi.fn(),
  useProviders: vi.fn(),
}));

const mockPatientUuid = 'patient-uuid-123';
const mockPatient = {
  id: mockPatientUuid,
  resourceType: 'Patient',
} as fhir.Patient;

const mockVisitContext = {
  uuid: 'visit-uuid-123',
  visitType: { display: 'Facility Visit' },
} as any;

const mockCloseWorkspace = vi.fn(() => Promise.resolve(true));
const mockMutateVisitContext = vi.fn();

const mockOrderBasketExtensionProps = {
  patient: mockPatient,
  launchDrugOrderForm: vi.fn(),
  launchLabOrderForm: vi.fn(),
  launchGeneralOrderForm: vi.fn(),
};

const defaultMockConfig = {
  orderTypes: [],
  orderEncounterType: 'order-encounter-type',
  ordererProviderRoles: [],
  orderLocationTagName: null,
  requireDiagnosisBeforeOrdering: true,
};

describe('OrderBasket', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseLayoutType.mockReturnValue('desktop' as LayoutType);
    mockUseConfig.mockReturnValue(defaultMockConfig);
    mockUseOrderBasket.mockReturnValue({
      orders: [],
      clearOrders: vi.fn(),
      setOrders: vi.fn(),
    } as any);
    mockUseMutatePatientOrders.mockReturnValue({
      mutate: vi.fn(),
    } as any);
    mockUseOrderEncounterForSystemWithVisitDisabled.mockReturnValue({
      visitRequired: false,
      isLoading: false,
      encounterUuid: null,
      error: null,
      mutate: vi.fn(),
    } as any);
    mockUseProviders.mockReturnValue({
      providers: [],
      isLoading: false,
      error: null,
    } as any);
  });

  it('should render without crashing when currentProvider is null', () => {
    mockUseSession.mockReturnValue({ ...mockSessionDataResponse.data, currentProvider: null } as any);

    render(
      <OrderBasket
        patientUuid={mockPatientUuid}
        patient={mockPatient}
        visitContext={mockVisitContext}
        mutateVisitContext={mockMutateVisitContext}
        closeWorkspace={mockCloseWorkspace}
        orderBasketExtensionProps={mockOrderBasketExtensionProps}
      />,
    );

    expect(screen.getByText('Order Basket')).toBeInTheDocument();
  });

  it('should render normally when currentProvider exists', () => {
    mockUseSession.mockReturnValue(mockSessionDataResponse.data as any);

    render(
      <OrderBasket
        patientUuid={mockPatientUuid}
        patient={mockPatient}
        visitContext={mockVisitContext}
        mutateVisitContext={mockMutateVisitContext}
        closeWorkspace={mockCloseWorkspace}
        orderBasketExtensionProps={mockOrderBasketExtensionProps}
      />,
    );

    expect(screen.getByText('Order Basket')).toBeInTheDocument();
  });

  describe('diagnosis check on Sign and close', () => {
    const renderWithAnOrder = () => {
      mockUseSession.mockReturnValue(mockSessionDataResponse.data as any);
      mockUseOrderBasket.mockReturnValue({
        orders: [{ display: 'Paracetamol', action: 'NEW' }],
        clearOrders: vi.fn(),
        setOrders: vi.fn(),
      } as any);
      mockPostOrdersOnNewEncounter.mockResolvedValue({ uuid: 'encounter-uuid', orders: [] } as any);

      render(
        <OrderBasket
          patientUuid={mockPatientUuid}
          patient={mockPatient}
          visitContext={mockVisitContext}
          mutateVisitContext={mockMutateVisitContext}
          closeWorkspace={mockCloseWorkspace}
          orderBasketExtensionProps={mockOrderBasketExtensionProps}
        />,
      );
    };

    it('does not submit the orders and asks for a diagnosis when the patient has no active diagnosis', async () => {
      const user = userEvent.setup();
      mockPatientHasActiveDiagnosis.mockResolvedValue(false);
      renderWithAnOrder();

      await user.click(screen.getByRole('button', { name: /sign and close/i }));

      expect(mockPatientHasActiveDiagnosis).toHaveBeenCalledWith(mockPatientUuid);
      expect(mockShowModal).toHaveBeenCalledWith('diagnosis-required-modal', expect.anything());
      expect(mockPostOrdersOnNewEncounter).not.toHaveBeenCalled();
      expect(mockCloseWorkspace).not.toHaveBeenCalled();
    });

    it('submits the orders as usual when the patient has an active diagnosis', async () => {
      const user = userEvent.setup();
      mockPatientHasActiveDiagnosis.mockResolvedValue(true);
      renderWithAnOrder();

      await user.click(screen.getByRole('button', { name: /sign and close/i }));

      expect(mockPostOrdersOnNewEncounter).toHaveBeenCalled();
      expect(mockShowModal).not.toHaveBeenCalled();
    });

    it('does not submit the orders when the diagnosis check fails', async () => {
      const user = userEvent.setup();
      mockPatientHasActiveDiagnosis.mockRejectedValue(new Error('network error'));
      renderWithAnOrder();

      await user.click(screen.getByRole('button', { name: /sign and close/i }));

      expect(await screen.findByText(/couldn't check the patient's diagnoses/i)).toBeInTheDocument();
      expect(mockPostOrdersOnNewEncounter).not.toHaveBeenCalled();
    });

    it('skips the check when requireDiagnosisBeforeOrdering is disabled', async () => {
      const user = userEvent.setup();
      mockUseConfig.mockReturnValue({ ...defaultMockConfig, requireDiagnosisBeforeOrdering: false });
      renderWithAnOrder();

      await user.click(screen.getByRole('button', { name: /sign and close/i }));

      expect(mockPatientHasActiveDiagnosis).not.toHaveBeenCalled();
      expect(mockPostOrdersOnNewEncounter).toHaveBeenCalled();
    });
  });
});
