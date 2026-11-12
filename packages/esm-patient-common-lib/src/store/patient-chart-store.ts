import { type Actions, createGlobalStore, useStoreWithActions, type Visit } from '@openmrs/esm-framework';

export interface PatientChartStore {
  patientUuid: string;
  patient: fhir.Patient;
  visitContext: Visit;
  mutateVisitContext: () => void;
  /**
   * True only when someone deliberately put an ended visit in context (picked a past visit in the
   * visit switcher, or created one in the visit form). It lets the chart tell that choice apart
   * from a visit that was active when it was put in context and has since been ended (the daily
   * auto-close, or another user ending it): the chart keeps the first and moves off the second, so
   * new orders and encounters don't get filed under, and dated by, a visit that is already over.
   */
  isPastVisitChosen?: boolean;
}

const patientChartStoreName = 'patient-chart-global-store';

const patientChartStore = createGlobalStore<PatientChartStore>(patientChartStoreName, {
  patientUuid: null,
  patient: null,
  visitContext: null,
  mutateVisitContext: null,
  isPastVisitChosen: false,
});

const patientChartStoreActions = {
  setPatient(_, patient: fhir.Patient) {
    return { patient, patientUuid: patient?.id ?? null };
  },
  setVisitContext(_, visitContext: Visit, mutateVisitContext: () => void) {
    return { visitContext, mutateVisitContext, isPastVisitChosen: Boolean(visitContext?.stopDatetime) };
  },
  forgetPastVisitChoice() {
    return { isPastVisitChosen: false };
  },
} satisfies Actions<PatientChartStore>;

/**
 * Hook to access the values and sets of the patient chart store.
 * Note: This hooks SHOULD only be used by components inside the patient chart app.
 *
 * Workspaces / extensions that can be mounted by other apps (ex: the start visit form in the queue's app,
 * the clinical forms workspace in the ward app)
 * should have the patient / visitContext explicitly passed in as props.
 *
 * As a safety feature, this hook requires the patientUuid as the input, and only
 * returns the actual store values if input patientUuid matches that in the store.
 */
export function usePatientChartStore(patientUuid: string) {
  const store = useStoreWithActions(patientChartStore, patientChartStoreActions);
  if (store.patientUuid === patientUuid) {
    return store;
  } else {
    const fakeStore: typeof store = {
      ...store,
      mutateVisitContext: null,
      setVisitContext: () => {},
      patient: null,
      patientUuid: null,
      visitContext: null,
      isPastVisitChosen: false,
    };
    return fakeStore;
  }
}
