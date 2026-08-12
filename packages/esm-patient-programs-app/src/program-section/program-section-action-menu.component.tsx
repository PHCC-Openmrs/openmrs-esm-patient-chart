import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Layer, OverflowMenu, OverflowMenuItem } from '@carbon/react';
import { launchWorkspace2, showModal, useLayoutType } from '@openmrs/esm-framework';
import { type ProgramSectionConfig } from '../config-schema';
import { type ProgramSectionEncounter } from './program-section.resource';
import styles from './program-section-action-menu.scss';

interface ProgramSectionActionMenuProps {
  encounter: ProgramSectionEncounter;
  section: ProgramSectionConfig;
  patientUuid: string;
}

export const ProgramSectionActionMenu = ({ encounter, section, patientUuid }: ProgramSectionActionMenuProps) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';

  const launchEditForm = useCallback(
    () =>
      launchWorkspace2('program-section-form-workspace', {
        workspaceTitle: t('editSectionTitle', 'Edit {{sectionTitle}}', { sectionTitle: section.sectionTitle }),
        section,
        encounterToEdit: encounter,
      }),
    [encounter, section, t],
  );

  const launchDeleteDialog = useCallback(() => {
    const dispose = showModal('program-section-delete-confirmation-modal', {
      closeDeleteModal: () => dispose(),
      encounterUuid: encounter.uuid,
      patientUuid,
      encounterTypeUuid: section.encounterTypeUuid,
      sectionTitle: section.sectionTitle,
      size: 'sm',
    });
  }, [encounter.uuid, patientUuid, section.encounterTypeUuid, section.sectionTitle]);

  return (
    <Layer className={styles.layer}>
      <OverflowMenu
        aria-label={t('editOrDeleteSection', 'Edit or delete {{sectionTitle}} record', {
          sectionTitle: section.sectionTitle,
        })}
        align="left"
        size={isTablet ? 'lg' : 'sm'}
        flipped
      >
        <OverflowMenuItem
          className={styles.menuItem}
          id="editSection"
          onClick={launchEditForm}
          itemText={t('edit', 'Edit')}
        />
        <OverflowMenuItem
          className={styles.menuItem}
          id="deleteSection"
          hasDivider
          isDelete
          onClick={launchDeleteDialog}
          itemText={t('delete', 'Delete')}
        />
      </OverflowMenu>
    </Layer>
  );
};
