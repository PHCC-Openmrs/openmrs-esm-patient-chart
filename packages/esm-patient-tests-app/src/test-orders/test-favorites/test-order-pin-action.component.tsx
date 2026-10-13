import React from 'react';
import { useTranslation } from 'react-i18next';
import { InlineLoading } from '@carbon/react';
import { Pin, PinFilled } from '@carbon/react/icons';
import { useTestPinToggle } from './test-favorites.hook';
import styles from './test-favorites.scss';

interface TestOrderPinActionProps {
  conceptUuid: string;
  label: string;
  orderTypeUuid: string;
}

const TestOrderPinAction: React.FC<TestOrderPinActionProps> = ({ conceptUuid, label, orderTypeUuid }) => {
  const { t } = useTranslation();
  const { isPinned, isSaving, isLoading, isEnabled, toggle } = useTestPinToggle(
    { uuid: conceptUuid, display: label },
    orderTypeUuid,
  );

  if (!isEnabled) {
    return null;
  }

  if (isLoading || isSaving) {
    return <InlineLoading className={styles.pinAction} />;
  }

  return (
    <div className={styles.pinAction}>
      {isPinned ? (
        <PinFilled size={16} className={styles.pinActionIcon} />
      ) : (
        <Pin size={16} className={styles.pinActionIcon} />
      )}
      <button type="button" className={styles.pinLink} onClick={toggle}>
        {isPinned
          ? t('removeFromPinnedOrders', 'Remove from my pinned orders')
          : t('addToPinnedOrders', 'Add to my pinned orders')}
      </button>
    </div>
  );
};

export default TestOrderPinAction;
