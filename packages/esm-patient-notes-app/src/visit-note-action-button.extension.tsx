import React, { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionMenuButton2, PenIcon, useSession, userHasAccess } from '@openmrs/esm-framework';
import { useStartVisitIfNeeded, type PatientChartWorkspaceActionButtonProps } from '@openmrs/esm-patient-common-lib';

/**
 * This button uses the patient chart store and MUST only be used
 * within the patient chart
 */
const VisitNoteActionButton: React.FC<PatientChartWorkspaceActionButtonProps> = ({ groupProps: { patientUuid } }) => {
  const { t } = useTranslation();

  const startVisitIfNeeded = useStartVisitIfNeeded(patientUuid);
  const session = useSession();
  // Saving a visit note creates an Encounter (and Observations), so the gate
  // needs to match what saveEncounter actually requires - not Get Forms,
  // which only covers reading the form definition to render it.
  const canRecordVisitNote =
    userHasAccess('Add Encounters', session?.user) || userHasAccess('Edit Encounters', session?.user);

  if (!canRecordVisitNote) {
    return null;
  }

  return (
    <ActionMenuButton2
      icon={(props: ComponentProps<typeof PenIcon>) => <PenIcon {...props} />}
      label={t('visitNote', 'Visit note')}
      workspaceToLaunch={{
        workspaceName: 'visit-notes-form-workspace',
        workspaceProps: {},
      }}
      onBeforeWorkspaceLaunch={startVisitIfNeeded}
    />
  );
};

export default VisitNoteActionButton;
