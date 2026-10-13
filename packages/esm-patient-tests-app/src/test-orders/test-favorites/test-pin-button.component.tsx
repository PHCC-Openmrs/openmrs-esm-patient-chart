import React from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton, InlineLoading } from '@carbon/react';
import { Pin, PinFilled } from '@carbon/react/icons';
import { useLayoutType } from '@openmrs/esm-framework';
import { useTestPinToggle } from './test-favorites.hook';

interface TestPinButtonProps {
  conceptUuid: string;
  label: string;
  orderTypeUuid: string;
}

const TestPinButton: React.FC<TestPinButtonProps> = ({ conceptUuid, label, orderTypeUuid }) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const { isPinned, isSaving, isLoading, isEnabled, toggle } = useTestPinToggle(
    { uuid: conceptUuid, display: label },
    orderTypeUuid,
  );

  if (!isEnabled) {
    return null;
  }

  if (isSaving || isLoading) {
    return <InlineLoading />;
  }

  return (
    <IconButton
      kind="ghost"
      size={isTablet ? 'md' : 'sm'}
      label={isPinned ? t('unpinOrder', 'Unpin order') : t('pinOrder', 'Pin order')}
      align="left"
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        toggle();
      }}
    >
      {isPinned ? <PinFilled /> : <Pin />}
    </IconButton>
  );
};

export default TestPinButton;
