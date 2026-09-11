import { useCallback } from 'react';
import { useLaunchWorkspaceRequiringVisit, usePatientChartStore } from '@openmrs/esm-patient-common-lib';
import { patientNursingFormWorkspace } from './constants';
import { useInvalidateNursingRecords } from './common';

/**
 * Returns a callback that opens the nursing form for a new record, wired up so that saving
 * refreshes both the visit context and the nursing widgets.
 */
export function useLaunchNursingForm(patientUuid: string) {
  const { mutateVisitContext, visitContext, patient } = usePatientChartStore(patientUuid);
  const invalidateNursingRecords = useInvalidateNursingRecords(patientUuid);
  const launchNursingForm = useLaunchWorkspaceRequiringVisit(patientUuid, patientNursingFormWorkspace);

  return useCallback(() => {
    launchNursingForm(
      {},
      {},
      {
        patient,
        patientUuid,
        visitContext,
        mutateVisitContext: () => {
          mutateVisitContext?.();
          invalidateNursingRecords();
        },
      },
    );
  }, [launchNursingForm, patient, patientUuid, visitContext, mutateVisitContext, invalidateNursingRecords]);
}
