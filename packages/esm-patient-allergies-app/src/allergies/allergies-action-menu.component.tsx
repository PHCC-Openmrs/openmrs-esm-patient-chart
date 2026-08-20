import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Layer, OverflowMenu, OverflowMenuItem } from '@carbon/react';
import { launchWorkspace2, showModal, useLayoutType, useSession, userHasAccess } from '@openmrs/esm-framework';
import { type Allergy } from '../types';
import { patientAllergiesFormWorkspace } from '../constants';
import styles from './allergies-action-menu.scss';

interface allergiesActionMenuProps {
  allergy: Allergy;
  patientUuid?: string;
}

export const AllergiesActionMenu = ({ allergy, patientUuid }: allergiesActionMenuProps) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const session = useSession();
  // saveAllergy (used by the edit form) accepts either privilege.
  const canEditAllergy =
    userHasAccess('Add Allergies', session?.user) || userHasAccess('Edit Allergies', session?.user);
  // Provisional: matches PatientService.removeAllergy (Edit Allergies). Core also
  // has a separate voidAllergy path gated by the privilege whose string value is
  // "Remove Allergies" (not "Delete Allergies", despite the constant's name) -
  // confirm which one the REST DELETE call actually hits before relying on this.
  const canDeleteAllergy = userHasAccess('Edit Allergies', session?.user);

  const launchEditAllergiesForm = useCallback(() => {
    launchWorkspace2(patientAllergiesFormWorkspace, {
      allergy,
      formContext: 'editing',
    });
  }, [allergy]);

  const launchDeleteAllergyDialog = (allergyId: string) => {
    const dispose = showModal('delete-allergy-modal', {
      closeDeleteModal: () => dispose(),
      allergyId,
      patientUuid,
    });
  };

  if (!canEditAllergy && !canDeleteAllergy) {
    return null;
  }

  return (
    <Layer className={styles.layer}>
      <OverflowMenu
        aria-label={t('editOrDeleteAllergy', 'Edit or delete allergy')}
        align="left"
        size={isTablet ? 'lg' : 'sm'}
        flipped
      >
        {canEditAllergy && (
          <OverflowMenuItem
            className={styles.menuItem}
            id="editAllergy"
            onClick={launchEditAllergiesForm}
            itemText={t('edit', 'Edit')}
          />
        )}
        {canDeleteAllergy && (
          <OverflowMenuItem
            className={styles.menuItem}
            id="deleteAllergy"
            itemText={t('delete', 'Delete')}
            onClick={() => launchDeleteAllergyDialog(allergy.id)}
            isDelete
            hasDivider
          />
        )}
      </OverflowMenu>
    </Layer>
  );
};
