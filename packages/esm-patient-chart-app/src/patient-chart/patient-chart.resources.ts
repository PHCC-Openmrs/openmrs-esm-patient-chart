import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import {
  launchWorkspaceGroup2,
  openmrsFetch,
  restBaseUrl,
  showSnackbar,
  usePatient,
  useVisit,
  type Visit,
} from '@openmrs/esm-framework';
import { type PatientWorkspaceGroupProps, usePatientChartStore } from '@openmrs/esm-patient-common-lib';

const defaultVisitCustomRepresentation =
  'custom:(uuid,display,voided,indication,startDatetime,stopDatetime,' +
  'encounters:(uuid,display,encounterDatetime,' +
  'form:(uuid,name),location:ref,' +
  'encounterType:ref,' +
  'encounterProviders:(uuid,display,' +
  'provider:(uuid,display))),' +
  'patient:(uuid,display),' +
  'visitType:(uuid,name,display),' +
  'attributes:(uuid,display,attributeType:(name,datatypeClassname,uuid),value),' +
  'location:(uuid,name,display))';

type WorkspaceGroupLaunchKey = {
  patientUuid: string | null;
  visitContextUuid: string | null;
};

// The workspace group is current only when it was launched for this patient and visit context.
function getWorkspaceGroupLaunchKey(groupProps: PatientWorkspaceGroupProps | null): WorkspaceGroupLaunchKey {
  return {
    patientUuid: groupProps?.patientUuid ?? null,
    visitContextUuid: groupProps?.visitContext?.uuid ?? null,
  };
}

function workspaceGroupLaunchKeysEqual(a: WorkspaceGroupLaunchKey | null, b: WorkspaceGroupLaunchKey | null) {
  return a?.patientUuid === b?.patientUuid && a?.visitContextUuid === b?.visitContextUuid;
}

export function useVisitByUuid(visitUuid: string | null, representation: string = defaultVisitCustomRepresentation) {
  const url = `${restBaseUrl}/visit/${visitUuid}?v=${representation}`;
  const { data, ...rest } = useSWR<{ data: Visit }>(visitUuid ? url : null, openmrsFetch);
  return { visit: data?.data, ...rest };
}

/**
 * This hook manages fetching of the patient and the visitContext
 * when entering the patient chart, and the associated updated to patient chart store.
 *
 * The patient chart store sets the patient when we enter the patient chart
 * and unsets the patient when we leave. (This gives extensions and workspaces a way
 * to check whether they are rendered within the patient chart app.)
 * Note: We do not unset visitContext when leaving the chart, so it persists across
 * in‑app navigation. On a full page reload, visitContext is rehydrated by refetching
 * (via useVisit/useVisitByUuId) rather than restored from storage.
 * When we enter the chart (and whenever either visit is refetched), the visit context is chosen as:
 * 1. The stored visitContext, refetched, if it belongs to the patient and is either still open or
 *    a past visit someone deliberately chose (see `isPastVisitChosen` in the store).
 * 2. Otherwise the patient's active visit, if they have one.
 * 3. Otherwise no visit.
 * A stored visit that was open when it was put in context but has since been ended (the daily
 * auto-close, or another user ending it) is therefore dropped rather than kept: keeping it filed
 * new orders under the ended visit, with the encounter backdated to its end, so a renewal showed
 * the old visit's date on the dispensing sheet. A deliberately chosen past visit is forgotten when
 * the chart is left, so a later return to the patient starts from their active visit again.
 * @param patientUuid
 * @returns
 */
export function usePatientChartPatientAndVisit(patientUuid: string) {
  const { t } = useTranslation();
  const { isLoading: isLoadingPatient, patient } = usePatient(patientUuid);
  const {
    patientUuid: storePatientUuid,
    setPatient,
    visitContext,
    mutateVisitContext,
    setVisitContext,
    isPastVisitChosen,
    forgetPastVisitChoice,
  } = usePatientChartStore(patientUuid);

  const isVisitContextValid = visitContext?.patient.uuid === patientUuid;
  const keepPastVisit = isVisitContextValid && Boolean(isPastVisitChosen);
  const {
    visit: newVisitContext,
    mutate: newMutateVisitContext,
    isValidating: isValidatingVisitContext,
  } = useVisitByUuid(isVisitContextValid ? visitContext.uuid : null);
  // The active visit is looked up even when a stored visit context exists: that visit may have been
  // ended since it was stored, and then the active visit (if any) is the one to use instead.
  const {
    activeVisit,
    isValidating: isValidatingActiveVisit,
    mutate: mutateActiveVisit,
  } = useVisit(keepPastVisit ? null : patientUuid);

  // A past visit chosen in this chart applies only while the chart stays open.
  const forgetPastVisitChoiceRef = useRef(forgetPastVisitChoice);
  forgetPastVisitChoiceRef.current = forgetPastVisitChoice;
  useEffect(() => () => forgetPastVisitChoiceRef.current?.(), []);

  const launchedWorkspaceGroupKey = useRef<WorkspaceGroupLaunchKey | null>(null);
  const latestWorkspaceGroupProps = useRef<PatientWorkspaceGroupProps | null>(null);
  const isWorkspaceGroupLaunchPending = useRef(false);
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const launchLatestWorkspaceGroup = useCallback(async () => {
    if (isWorkspaceGroupLaunchPending.current) {
      return;
    }

    isWorkspaceGroupLaunchPending.current = true;

    try {
      let needsLaunch = true;
      while (needsLaunch) {
        const groupProps = latestWorkspaceGroupProps.current;
        const launchKey = getWorkspaceGroupLaunchKey(groupProps);

        if (workspaceGroupLaunchKeysEqual(launchKey, launchedWorkspaceGroupKey.current)) {
          needsLaunch = false;
          continue;
        }

        if (!isMounted.current) {
          return;
        }

        const launched = await launchWorkspaceGroup2('patient-chart', groupProps);

        if (!isMounted.current) {
          return;
        }

        // launchWorkspaceGroup2 returns false when the user keeps the current workspace group open.
        if (!launched) {
          needsLaunch = false;
          continue;
        }

        launchedWorkspaceGroupKey.current = launchKey;

        const latestLaunchKey = getWorkspaceGroupLaunchKey(latestWorkspaceGroupProps.current);
        if (workspaceGroupLaunchKeysEqual(latestLaunchKey, launchedWorkspaceGroupKey.current)) {
          needsLaunch = false;
        }
      }
    } finally {
      isWorkspaceGroupLaunchPending.current = false;
    }
  }, []);

  useEffect(() => {
    const initializeWorkspaceGroup = async () => {
      if (!isValidatingVisitContext && !isValidatingActiveVisit && patient) {
        let groupProps: PatientWorkspaceGroupProps = null;
        if (newVisitContext && (keepPastVisit || !newVisitContext.stopDatetime)) {
          groupProps = {
            patientUuid: patient.id,
            patient,
            visitContext: newVisitContext,
            mutateVisitContext: newMutateVisitContext,
          };
        } else if (activeVisit) {
          groupProps = {
            patientUuid: patient.id,
            patient,
            visitContext: activeVisit,
            mutateVisitContext: mutateActiveVisit,
          };
        } else {
          groupProps = {
            patientUuid: patient.id,
            patient,
            visitContext: null,
            mutateVisitContext: null,
          };
        }

        setVisitContext(groupProps.visitContext, groupProps.mutateVisitContext);

        latestWorkspaceGroupProps.current = groupProps;
        await launchLatestWorkspaceGroup();
      }
    };

    initializeWorkspaceGroup().catch((error) => {
      showSnackbar({
        title: t('errorLaunchingWorkspaceGroup', 'Error launching workspace group'),
        subtitle: error.message,
        kind: 'error',
        isLowContrast: false,
      });
    });

    return () => {};
  }, [
    newVisitContext,
    keepPastVisit,
    isValidatingVisitContext,
    newMutateVisitContext,
    setVisitContext,
    activeVisit,
    isValidatingActiveVisit,
    storePatientUuid,
    mutateActiveVisit,
    patient,
    t,
    launchLatestWorkspaceGroup,
  ]);

  useEffect(() => {
    if (!isLoadingPatient) {
      setPatient(patient);
    }

    return () => {
      setPatient(null);
    };
  }, [patient, setPatient, isLoadingPatient]);

  const state = useMemo(
    () => ({
      patientUuid,
      patient: patient ?? {},
      visitContext,
      mutateVisitContext,
      isLoadingPatient,
      setPatient,
    }),
    [patient, patientUuid, visitContext, mutateVisitContext, isLoadingPatient, setPatient],
  );

  return state;
}
