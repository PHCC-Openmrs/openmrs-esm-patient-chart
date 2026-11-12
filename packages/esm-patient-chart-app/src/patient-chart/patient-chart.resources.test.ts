import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { launchWorkspaceGroup2, openmrsFetch, usePatient, useVisit, type Visit } from '@openmrs/esm-framework';
import { usePatientChartStore } from '@openmrs/esm-patient-common-lib';
import { mockFhirPatient } from '__mocks__';
import { usePatientChartPatientAndVisit } from './patient-chart.resources';

// TODO: remove once openmrs-esm-core ships launchWorkspaceGroup2 in the framework mock
vi.mock('@openmrs/esm-framework', async () => {
  const actual = (await vi.importActual('@openmrs/esm-framework')) as object;
  return { ...actual, launchWorkspaceGroup2: vi.fn() };
});

vi.mock('@openmrs/esm-patient-common-lib', () => ({
  usePatientChartStore: vi.fn(),
}));

const mockLaunchWorkspaceGroup = vi.mocked(launchWorkspaceGroup2);
const mockUsePatient = vi.mocked(usePatient);
const mockUseVisit = vi.mocked(useVisit);
const mockUsePatientChartStore = vi.mocked(usePatientChartStore);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const mutateVisitContext = vi.fn();
const setPatient = vi.fn();
const setVisitContext = vi.fn();
const forgetPastVisitChoice = vi.fn();

const visitA = { uuid: 'visit-a', patient: { uuid: mockFhirPatient.id } } as Visit;
const visitB = { uuid: 'visit-b', patient: { uuid: mockFhirPatient.id } } as Visit;
const patientB = { ...mockFhirPatient, id: 'patient-b' };

function mockNoActiveVisitForPatientSwitch() {
  mockUsePatient.mockImplementation((patientUuid) => ({
    isLoading: false,
    patient: patientUuid === patientB.id ? patientB : mockFhirPatient,
    patientUuid,
    error: null,
  }));
  mockUseVisit.mockImplementation(() => ({
    activeVisit: null,
    mutate: mutateVisitContext,
    isValidating: false,
    error: null,
    currentVisit: null,
    currentVisitIsRetrospective: false,
    isLoading: false,
  }));
  mockUsePatientChartStore.mockImplementation((patientUuid) => ({
    patientUuid,
    patient: patientUuid === patientB.id ? patientB : mockFhirPatient,
    visitContext: null,
    mutateVisitContext: null,
    setPatient,
    setVisitContext,
    forgetPastVisitChoice,
  }));
}

describe('usePatientChartPatientAndVisit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLaunchWorkspaceGroup.mockResolvedValue(true);
    mockUsePatient.mockReturnValue({
      isLoading: false,
      patient: mockFhirPatient,
      patientUuid: mockFhirPatient.id,
      error: null,
    });
    mockUsePatientChartStore.mockReturnValue({
      patientUuid: mockFhirPatient.id,
      patient: mockFhirPatient,
      visitContext: null,
      mutateVisitContext: null,
      setPatient,
      setVisitContext,
      forgetPastVisitChoice,
    });
  });

  it('relaunches the patient-chart workspace group when the visit context changes', async () => {
    let activeVisit = visitA;
    mockUseVisit.mockImplementation(() => ({
      activeVisit,
      mutate: mutateVisitContext,
      isValidating: false,
      error: null,
      currentVisit: null,
      currentVisitIsRetrospective: false,
      isLoading: false,
    }));

    const { rerender } = renderHook(() => usePatientChartPatientAndVisit(mockFhirPatient.id));

    await waitFor(() => expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(1));
    expect(mockLaunchWorkspaceGroup).toHaveBeenLastCalledWith(
      'patient-chart',
      expect.objectContaining({
        patient: mockFhirPatient,
        patientUuid: mockFhirPatient.id,
        visitContext: visitA,
        mutateVisitContext,
      }),
    );

    activeVisit = visitB;
    rerender();

    await waitFor(() => expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(2));
    expect(mockLaunchWorkspaceGroup).toHaveBeenLastCalledWith(
      'patient-chart',
      expect.objectContaining({
        patient: mockFhirPatient,
        patientUuid: mockFhirPatient.id,
        visitContext: visitB,
        mutateVisitContext,
      }),
    );
  });

  it('does not relaunch when the same visit UUID is returned with new object references', async () => {
    let activeVisit: Visit = visitA;
    mockUseVisit.mockImplementation(() => ({
      activeVisit,
      mutate: mutateVisitContext,
      isValidating: false,
      error: null,
      currentVisit: null,
      currentVisitIsRetrospective: false,
      isLoading: false,
    }));

    const { rerender } = renderHook(() => usePatientChartPatientAndVisit(mockFhirPatient.id));

    await waitFor(() => expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(1));

    // Same UUID, new object reference — mimics SWR revalidation
    activeVisit = { ...visitA, stopDatetime: '2026-05-26T00:00:00.000Z' } as Visit;
    rerender();

    // Wait for the effect to fire before asserting the launch count didn't increase
    await waitFor(() => expect(setVisitContext).toHaveBeenCalledTimes(2));
    expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(1);
  });

  it('relaunches when the patient changes and neither patient has an active visit', async () => {
    mockNoActiveVisitForPatientSwitch();

    const { rerender } = renderHook(({ patientUuid }) => usePatientChartPatientAndVisit(patientUuid), {
      initialProps: { patientUuid: mockFhirPatient.id },
    });

    await waitFor(() => expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(1));
    expect(mockLaunchWorkspaceGroup).toHaveBeenLastCalledWith(
      'patient-chart',
      expect.objectContaining({ patientUuid: mockFhirPatient.id, visitContext: null }),
    );

    rerender({ patientUuid: patientB.id });

    await waitFor(() => expect(setVisitContext).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(2));
    expect(mockLaunchWorkspaceGroup).toHaveBeenLastCalledWith(
      'patient-chart',
      expect.objectContaining({ patientUuid: patientB.id, visitContext: null }),
    );
  });

  it('launches the latest patient after a previous launch resolves', async () => {
    let patientUuid = mockFhirPatient.id;
    let resolveFirstLaunch!: (value: boolean) => void;
    const firstLaunch = new Promise<boolean>((resolve) => {
      resolveFirstLaunch = resolve;
    });

    mockLaunchWorkspaceGroup.mockReturnValueOnce(firstLaunch).mockResolvedValue(true);
    mockNoActiveVisitForPatientSwitch();

    const { rerender } = renderHook(() => usePatientChartPatientAndVisit(patientUuid));

    await waitFor(() => expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(1));
    expect(mockLaunchWorkspaceGroup).toHaveBeenLastCalledWith(
      'patient-chart',
      expect.objectContaining({ patientUuid: mockFhirPatient.id, visitContext: null }),
    );

    patientUuid = patientB.id;
    rerender();

    await waitFor(() => expect(setVisitContext).toHaveBeenCalledTimes(2));
    expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(1);

    resolveFirstLaunch(true);

    await waitFor(() => expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(2));
    expect(mockLaunchWorkspaceGroup).toHaveBeenLastCalledWith(
      'patient-chart',
      expect.objectContaining({ patientUuid: patientB.id, visitContext: null }),
    );
  });

  it('launches the latest visit context after a previous launch resolves', async () => {
    let activeVisit = visitA;
    let resolveFirstLaunch!: (value: boolean) => void;
    const firstLaunch = new Promise<boolean>((resolve) => {
      resolveFirstLaunch = resolve;
    });

    mockLaunchWorkspaceGroup.mockReturnValueOnce(firstLaunch).mockResolvedValue(true);
    mockUseVisit.mockImplementation(() => ({
      activeVisit,
      mutate: mutateVisitContext,
      isValidating: false,
      error: null,
      currentVisit: null,
      currentVisitIsRetrospective: false,
      isLoading: false,
    }));

    const { rerender } = renderHook(() => usePatientChartPatientAndVisit(mockFhirPatient.id));

    await waitFor(() => expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(1));
    expect(mockLaunchWorkspaceGroup).toHaveBeenLastCalledWith(
      'patient-chart',
      expect.objectContaining({ visitContext: visitA }),
    );

    activeVisit = visitB;
    rerender();

    await waitFor(() => expect(setVisitContext).toHaveBeenCalledTimes(2));
    expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(1);

    resolveFirstLaunch(true);

    await waitFor(() => expect(mockLaunchWorkspaceGroup).toHaveBeenCalledTimes(2));
    expect(mockLaunchWorkspaceGroup).toHaveBeenLastCalledWith(
      'patient-chart',
      expect.objectContaining({ visitContext: visitB }),
    );
  });

  describe('when the visit in context has been ended since it was put there', () => {
    const endedAt = '2026-11-10T16:00:00.000+0000';

    // The store still holds the visit as it was when put in context (open); refetching it shows it ended.
    function mockStoredVisit(storedVisit: Visit, refetchedVisit: Visit, isPastVisitChosen: boolean) {
      mockUsePatientChartStore.mockReturnValue({
        patientUuid: mockFhirPatient.id,
        patient: mockFhirPatient,
        visitContext: storedVisit,
        mutateVisitContext: null,
        isPastVisitChosen,
        setPatient,
        setVisitContext,
        forgetPastVisitChoice,
      });
      mockOpenmrsFetch.mockImplementation((url: string) =>
        url.includes(`/visit/${storedVisit.uuid}`)
          ? Promise.resolve({ data: refetchedVisit } as Awaited<ReturnType<typeof openmrsFetch>>)
          : Promise.resolve({ data: {} } as Awaited<ReturnType<typeof openmrsFetch>>),
      );
    }

    function mockActiveVisit(activeVisit: Visit | null) {
      mockUseVisit.mockImplementation(() => ({
        activeVisit,
        mutate: mutateVisitContext,
        isValidating: false,
        error: null,
        currentVisit: null,
        currentVisitIsRetrospective: false,
        isLoading: false,
      }));
    }

    it("switches to the patient's new active visit", async () => {
      const yesterday = { uuid: 'visit-ended-1', patient: { uuid: mockFhirPatient.id } } as Visit;
      const today = { uuid: 'visit-today-1', patient: { uuid: mockFhirPatient.id } } as Visit;
      mockStoredVisit(yesterday, { ...yesterday, stopDatetime: endedAt }, false);
      mockActiveVisit(today);

      renderHook(() => usePatientChartPatientAndVisit(mockFhirPatient.id));

      await waitFor(() => expect(mockLaunchWorkspaceGroup).toHaveBeenCalled());
      expect(mockUseVisit).toHaveBeenCalledWith(mockFhirPatient.id);
      expect(setVisitContext).toHaveBeenLastCalledWith(today, mutateVisitContext);
      expect(mockLaunchWorkspaceGroup).toHaveBeenLastCalledWith(
        'patient-chart',
        expect.objectContaining({ visitContext: today }),
      );
    });

    it('clears the visit context when the patient has no active visit', async () => {
      const yesterday = { uuid: 'visit-ended-2', patient: { uuid: mockFhirPatient.id } } as Visit;
      mockStoredVisit(yesterday, { ...yesterday, stopDatetime: endedAt }, false);
      mockActiveVisit(null);

      renderHook(() => usePatientChartPatientAndVisit(mockFhirPatient.id));

      await waitFor(() =>
        expect(mockOpenmrsFetch).toHaveBeenCalledWith(expect.stringContaining('/visit/visit-ended-2')),
      );
      await waitFor(() => expect(mockLaunchWorkspaceGroup).toHaveBeenCalled());
      expect(setVisitContext).toHaveBeenLastCalledWith(null, null);
      expect(mockLaunchWorkspaceGroup).toHaveBeenLastCalledWith(
        'patient-chart',
        expect.objectContaining({ visitContext: null }),
      );
    });

    it('keeps the stored visit while it is still open', async () => {
      const open = { uuid: 'visit-open-3', patient: { uuid: mockFhirPatient.id } } as Visit;
      mockStoredVisit(open, { ...open, stopDatetime: null }, false);
      mockActiveVisit(null);

      renderHook(() => usePatientChartPatientAndVisit(mockFhirPatient.id));

      await waitFor(() =>
        expect(mockLaunchWorkspaceGroup).toHaveBeenLastCalledWith(
          'patient-chart',
          expect.objectContaining({ visitContext: expect.objectContaining({ uuid: 'visit-open-3' }) }),
        ),
      );
    });

    it('keeps a past visit that was deliberately chosen, without looking up the active visit', async () => {
      const past = { uuid: 'visit-past-4', patient: { uuid: mockFhirPatient.id }, stopDatetime: endedAt } as Visit;
      mockStoredVisit(past, past, true);
      mockActiveVisit({ uuid: 'visit-today-4', patient: { uuid: mockFhirPatient.id } } as Visit);

      renderHook(() => usePatientChartPatientAndVisit(mockFhirPatient.id));

      await waitFor(() =>
        expect(mockLaunchWorkspaceGroup).toHaveBeenLastCalledWith(
          'patient-chart',
          expect.objectContaining({ visitContext: expect.objectContaining({ uuid: 'visit-past-4' }) }),
        ),
      );
      expect(mockUseVisit).toHaveBeenCalledWith(null);
      expect(mockUseVisit).not.toHaveBeenCalledWith(mockFhirPatient.id);
    });

    it('forgets a chosen past visit when the chart is left', () => {
      const past = { uuid: 'visit-past-5', patient: { uuid: mockFhirPatient.id }, stopDatetime: endedAt } as Visit;
      mockStoredVisit(past, past, true);
      mockActiveVisit(null);

      const { unmount } = renderHook(() => usePatientChartPatientAndVisit(mockFhirPatient.id));
      expect(forgetPastVisitChoice).not.toHaveBeenCalled();

      unmount();
      expect(forgetPastVisitChoice).toHaveBeenCalledTimes(1);
    });
  });
});
