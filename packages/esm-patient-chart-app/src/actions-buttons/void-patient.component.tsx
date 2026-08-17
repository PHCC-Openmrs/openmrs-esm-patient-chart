import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { OverflowMenuItem } from '@carbon/react';
import { showModal, userHasAccess, useSession } from '@openmrs/esm-framework';
import styles from './action-button.scss';

interface VoidPatientOverflowMenuItemProps {
  patientUuid: string;
  patient?: fhir.Patient;
  closeMenu?: () => void;
}

/**
 * Soft-deletes (voids) the current patient. Only shown to users holding the core "Delete
 * Patients" privilege (superusers/admins have this implicitly), so ordinary clinical staff
 * never see the option.
 */
const VoidPatientOverflowMenuItem: React.FC<VoidPatientOverflowMenuItemProps> = ({
  patientUuid,
  patient,
  closeMenu,
}) => {
  const { t } = useTranslation();
  const session = useSession();
  const canDeletePatients = userHasAccess('Delete Patients', session?.user);

  const handleLaunchModal = useCallback(() => {
    const dispose = showModal('void-patient-dialog', {
      closeModal: () => dispose(),
      patient,
      patientUuid,
    });
  }, [patient, patientUuid]);

  return (
    canDeletePatients && (
      <OverflowMenuItem
        className={styles.menuitem}
        closeMenu={closeMenu}
        hasDivider
        isDelete
        itemText={t('deletePatient', 'Delete patient')}
        onClick={handleLaunchModal}
      />
    )
  );
};

export default VoidPatientOverflowMenuItem;
