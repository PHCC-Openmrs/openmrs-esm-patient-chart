import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Layer, OverflowMenu, OverflowMenuItem } from '@carbon/react';
import { launchWorkspace2, showModal, useLayoutType, useSession, userHasAccess } from '@openmrs/esm-framework';
import { patientVitalsBiometricsFormWorkspace } from '../../constants';
import { canRecordVitalsAndBiometrics } from '../../common';
import styles from './vitals-biometrics-action-menu.scss';

interface VitalsAndBiometricsActionMenuProps {
  patient: fhir.Patient;
  encounterUuid: string;
}

export const VitalsAndBiometricsActionMenu = ({ encounterUuid, patient }: VitalsAndBiometricsActionMenuProps) => {
  const { t } = useTranslation();
  const patientUuid = patient.id;
  const isTablet = useLayoutType() === 'tablet';
  const session = useSession();
  const canEdit = canRecordVitalsAndBiometrics(session?.user);
  const canDelete = userHasAccess('Edit Encounters', session?.user);

  const handleLaunchVitalsAndBiometricsForm = useCallback(() => {
    launchWorkspace2(patientVitalsBiometricsFormWorkspace, {
      workspaceTitle: t('editVitalsAndBiometrics', 'Edit Vitals and Biometrics'),
      editEncounterUuid: encounterUuid,
      formContext: 'editing',
    });
  }, [encounterUuid, t]);

  const handleLaunchDeleteVitalsAndBiometricsModal = useCallback(() => {
    const dispose = showModal('vitals-biometrics-delete-confirmation-modal', {
      closeDeleteModal: () => dispose(),
      encounterUuid,
      patientUuid,
    });
  }, [encounterUuid, patientUuid]);

  if (!canEdit && !canDelete) {
    return null;
  }

  return (
    <Layer className={styles.layer}>
      <OverflowMenu
        aria-label={t('editOrDeleteVitalsAndBiometrics', 'Edit or delete Vitals and Biometrics')}
        align="left"
        size={isTablet ? 'lg' : 'sm'}
        flipped
        id={encounterUuid}
      >
        {canEdit && (
          <OverflowMenuItem
            className={styles.menuItem}
            id="editVitalsAndBiometrics"
            onClick={handleLaunchVitalsAndBiometricsForm}
            itemText={t('edit', 'Edit')}
          />
        )}
        {canDelete && (
          <OverflowMenuItem
            className={styles.menuItem}
            id="deleteVitalsAndBiometrics"
            itemText={t('delete', 'Delete')}
            onClick={handleLaunchDeleteVitalsAndBiometricsModal}
            isDelete
            hasDivider
          />
        )}
      </OverflowMenu>
    </Layer>
  );
};
