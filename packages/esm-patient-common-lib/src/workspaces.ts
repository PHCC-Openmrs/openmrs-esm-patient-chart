import { useCallback, useRef } from 'react';
import {
  launchWorkspace2,
  navigate,
  showModal,
  useFeatureFlag,
  type Visit,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import { usePatientChartStore } from './store/patient-chart-store';
import { useSystemVisitSetting } from './useSystemVisitSetting';

export interface PatientWorkspaceGroupProps {
  patient: fhir.Patient;
  patientUuid: string;
  visitContext: Visit;
  mutateVisitContext: () => void;
}

export interface PatientChartWorkspaceActionButtonProps {
  groupProps: PatientWorkspaceGroupProps;
}

export type PatientWorkspace2DefinitionProps<
  WorkspaceProps extends object,
  WindowProps extends object,
> = Workspace2DefinitionProps<WorkspaceProps, WindowProps, PatientWorkspaceGroupProps>;

export function launchPatientChartWithWorkspaceOpen({
  patientUuid,
  workspaceName,
  dashboardName,
  additionalProps,
}: {
  patientUuid: string;
  workspaceName: string;
  dashboardName?: string;
  additionalProps?: object;
}) {
  launchWorkspace2(workspaceName, additionalProps);
  navigate({ to: '${openmrsSpaBase}/patient/' + `${patientUuid}/chart` + (dashboardName ? `/${dashboardName}` : '') });
}

export function useLaunchWorkspaceRequiringVisit<T extends object>(patientUuid: string, workspaceName: string) {
  const startVisitIfNeeded = useStartVisitIfNeeded(patientUuid);
  const launchPatientWorkspaceCb = useCallback(
    (workspaceProps?: T, windowProps?: any, groupProps?: any) => {
      startVisitIfNeeded().then((didStartVisit) => {
        if (didStartVisit) {
          launchWorkspace2(workspaceName, workspaceProps, windowProps, groupProps);
        }
      });
    },
    [startVisitIfNeeded, workspaceName],
  );
  return launchPatientWorkspaceCb;
}

export function useStartVisitIfNeeded(patientUuid: string) {
  const { visitContext } = usePatientChartStore(patientUuid);
  const { systemVisitEnabled } = useSystemVisitSetting();
  const isRdeEnabled = useFeatureFlag('rde');
  // Tracks a start-visit flow already in progress for this patient, so that triggering
  // it again (e.g. clicking another action button before the first flow's visit form
  // has been submitted) reuses the same flow instead of opening a second "start visit"
  // dialog / workspace, which would otherwise race and surface a duplicate discard-changes prompt.
  const pendingStartVisitPromiseRef = useRef<Promise<boolean> | null>(null);

  const startVisitIfNeeded = useCallback(async (): Promise<boolean> => {
    if (!systemVisitEnabled || visitContext) {
      return true;
    }

    if (pendingStartVisitPromiseRef.current) {
      return pendingStartVisitPromiseRef.current;
    }

    const promise = new Promise<boolean>((resolve) => {
      const settle = (result: boolean) => {
        pendingStartVisitPromiseRef.current = null;
        resolve(result);
      };

      if (isRdeEnabled) {
        const dispose = showModal('visit-context-switcher', {
          patientUuid,
          closeModal: () => {
            dispose();
            settle(false);
          },
          onAfterVisitSelected: () => {
            settle(true);
          },
          size: 'sm',
        });
      } else {
        const dispose = showModal('start-visit-dialog', {
          closeModal: () => dispose(),
          onVisitStarted: () => settle(true),
        });
      }
    });

    pendingStartVisitPromiseRef.current = promise;
    return promise;
  }, [visitContext, systemVisitEnabled, isRdeEnabled, patientUuid]);
  return startVisitIfNeeded;
}
