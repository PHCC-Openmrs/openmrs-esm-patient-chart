import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Layer, OverflowMenu, OverflowMenuItem } from '@carbon/react';
import { launchWorkspace2, showModal, useLayoutType, useSession, userHasAccess } from '@openmrs/esm-framework';
import { type ProgramSectionConfig } from '../config-schema';
import { type ProgramSectionEncounter } from './program-section.resource';
import { translateProgramSectionText } from './program-section-translation';
import styles from './program-section-action-menu.scss';

interface ProgramSectionActionMenuProps {
  encounter: ProgramSectionEncounter;
  section: ProgramSectionConfig;
  patientUuid: string;
  isActive: boolean;
}

export const ProgramSectionActionMenu = ({
  encounter,
  section,
  patientUuid,
  isActive,
}: ProgramSectionActionMenuProps) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const session = useSession();
  const sectionTitle = translateProgramSectionText(t, section.sectionTitle);
  // A completed enrollment's section is shown for history, but only the currently active
  // enrollment for this program can have its records edited or deleted.
  const canEdit = isActive && userHasAccess('Task: patientChart.recordProgramSection', session?.user);
  const canDelete = isActive && userHasAccess('Task: patientChart.recordProgramSection', session?.user);

  const launchEditForm = useCallback(
    () =>
      launchWorkspace2('program-section-form-workspace', {
        workspaceTitle: t('editSectionTitle', 'Edit {{sectionTitle}}', { sectionTitle }),
        section,
        encounterToEdit: encounter,
      }),
    [encounter, section, sectionTitle, t],
  );

  const launchDeleteDialog = useCallback(() => {
    const dispose = showModal('program-section-delete-confirmation-modal', {
      closeDeleteModal: () => dispose(),
      encounterUuid: encounter.uuid,
      patientUuid,
      encounterTypeUuid: section.encounterTypeUuid,
      sectionTitle,
      size: 'sm',
    });
  }, [encounter.uuid, patientUuid, section.encounterTypeUuid, sectionTitle]);

  if (!canEdit && !canDelete) {
    return null;
  }

  return (
    <Layer className={styles.layer}>
      <OverflowMenu
        aria-label={t('editOrDeleteSection', 'Edit or delete {{sectionTitle}} record', { sectionTitle })}
        align="left"
        size={isTablet ? 'lg' : 'sm'}
        flipped
      >
        {canEdit && (
          <OverflowMenuItem
            className={styles.menuItem}
            id="editSection"
            onClick={launchEditForm}
            itemText={t('edit', 'Edit')}
          />
        )}
        {canDelete && (
          <OverflowMenuItem
            className={styles.menuItem}
            id="deleteSection"
            hasDivider
            isDelete
            onClick={launchDeleteDialog}
            itemText={t('delete', 'Delete')}
          />
        )}
      </OverflowMenu>
    </Layer>
  );
};
