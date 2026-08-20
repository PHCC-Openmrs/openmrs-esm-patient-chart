import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Layer, OverflowMenu, OverflowMenuItem } from '@carbon/react';
import { launchWorkspace2, showModal, useLayoutType, useSession, userHasAccess } from '@openmrs/esm-framework';
import { type Condition } from './conditions.resource';
import styles from './conditions-action-menu.scss';

interface conditionsActionMenuProps {
  condition: Condition;
  patientUuid?: string;
}

export const ConditionsActionMenu = ({ condition, patientUuid }: conditionsActionMenuProps) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const session = useSession();
  // Both editing and voiding a condition are gated by the same backend
  // privilege (there's no separate Add/Delete Conditions privilege).
  const canEditConditions = userHasAccess('Edit Conditions', session?.user);

  const launchEditConditionsForm = useCallback(
    () =>
      launchWorkspace2('conditions-form-workspace', {
        workspaceTitle: t('editCondition', 'Edit condition'),
        condition,
        formContext: 'editing',
      }),
    [condition, t],
  );

  const launchDeleteConditionDialog = (conditionId: string) => {
    const dispose = showModal('condition-delete-confirmation-dialog', {
      closeDeleteModal: () => dispose(),
      conditionId,
      patientUuid,
    });
  };

  if (!canEditConditions) {
    return null;
  }

  return (
    <Layer className={styles.layer}>
      <OverflowMenu aria-label="Edit or delete condition" align="left" size={isTablet ? 'lg' : 'sm'} flipped>
        <OverflowMenuItem
          className={styles.menuItem}
          id="editCondition"
          onClick={launchEditConditionsForm}
          itemText={t('edit', 'Edit')}
        />
        <OverflowMenuItem
          className={styles.menuItem}
          id="deleteCondition"
          itemText={t('delete', 'Delete')}
          onClick={() => launchDeleteConditionDialog(condition.id)}
          isDelete
          hasDivider
        />
      </OverflowMenu>
    </Layer>
  );
};
