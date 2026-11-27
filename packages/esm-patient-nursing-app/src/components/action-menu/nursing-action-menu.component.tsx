import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Layer, OverflowMenu, OverflowMenuItem } from '@carbon/react';
import { launchWorkspace2, showModal, useLayoutType, useSession, userHasAccess } from '@openmrs/esm-framework';
import { type NursingFormSection, nursingDeleteConfirmationModal, patientNursingFormWorkspace } from '../../constants';
import styles from './nursing-action-menu.scss';

interface NursingActionMenuProps {
  patientUuid: string;
  encounterUuid: string;
  /** Edit opens only this part of the form -- the sections of the card the row is in. */
  section?: NursingFormSection;
}

export const NursingActionMenu: React.FC<NursingActionMenuProps> = ({ encounterUuid, patientUuid, section }) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const session = useSession();
  const canRecordNursing = userHasAccess('Task: patientChart.recordNursing', session?.user);

  const handleLaunchEditForm = useCallback(() => {
    launchWorkspace2(patientNursingFormWorkspace, {
      editEncounterUuid: encounterUuid,
      formContext: 'editing',
      section,
    });
  }, [encounterUuid, section]);

  const handleLaunchDeleteModal = useCallback(() => {
    const dispose = showModal(nursingDeleteConfirmationModal, {
      closeDeleteModal: () => dispose(),
      encounterUuid,
      patientUuid,
    });
  }, [encounterUuid, patientUuid]);

  if (!canRecordNursing) {
    return null;
  }

  return (
    <Layer className={styles.layer}>
      <OverflowMenu
        aria-label={t('editOrDeleteNursing', 'Edit or delete nursing record')}
        align="left"
        size={isTablet ? 'lg' : 'sm'}
        flipped
        id={encounterUuid}
      >
        <OverflowMenuItem
          className={styles.menuItem}
          id="editNursing"
          onClick={handleLaunchEditForm}
          itemText={t('edit', 'Edit')}
        />
        <OverflowMenuItem
          className={styles.menuItem}
          id="deleteNursing"
          itemText={t('delete', 'Delete')}
          onClick={handleLaunchDeleteModal}
          isDelete
          hasDivider
        />
      </OverflowMenu>
    </Layer>
  );
};
