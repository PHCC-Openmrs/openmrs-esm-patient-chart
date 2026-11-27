import { useCallback } from 'react';
import { useLaunchWorkspaceRequiringVisit, usePatientChartStore } from '@openmrs/esm-patient-common-lib';
import { type NursingFormSection, patientNursingFormWorkspace } from './constants';
import { useInvalidateNursingRecords } from './common';

/**
 * Returns a callback that opens the nursing form for a new record, wired up so that saving
 * refreshes both the visit context and the nursing widgets. `section` limits the form to the
 * sections of the card it was opened from.
 */
export function useLaunchNursingForm(patientUuid: string, section?: NursingFormSection) {
  const { mutateVisitContext, visitContext, patient } = usePatientChartStore(patientUuid);
  const invalidateNursingRecords = useInvalidateNursingRecords(patientUuid);
  const launchNursingForm = useLaunchWorkspaceRequiringVisit(patientUuid, patientNursingFormWorkspace);

  return useCallback(() => {
    launchNursingForm(
      { section },
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
  }, [launchNursingForm, section, patient, patientUuid, visitContext, mutateVisitContext, invalidateNursingRecords]);
}
