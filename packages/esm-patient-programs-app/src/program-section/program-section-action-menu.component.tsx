import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Layer, OverflowMenu, OverflowMenuItem } from '@carbon/react';
import { launchWorkspace2, useLayoutType } from '@openmrs/esm-framework';
import { type ProgramSectionConfig } from '../config-schema';
import { type ProgramSectionEncounter } from './program-section.resource';
import styles from './program-section-action-menu.scss';

interface ProgramSectionActionMenuProps {
  encounter: ProgramSectionEncounter;
  section: ProgramSectionConfig;
}

export const ProgramSectionActionMenu = ({ encounter, section }: ProgramSectionActionMenuProps) => {
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

  return (
    <Layer className={styles.layer}>
      <OverflowMenu
        aria-label={t('editSection', 'Edit {{sectionTitle}}', { sectionTitle: section.sectionTitle })}
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
      </OverflowMenu>
    </Layer>
  );
};
