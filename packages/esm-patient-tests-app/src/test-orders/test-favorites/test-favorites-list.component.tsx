import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton, InlineNotification, SkeletonText } from '@carbon/react';
import { ChevronDown, ChevronUp, PinFilled } from '@carbon/react/icons';
import { useConfig, useLayoutType } from '@openmrs/esm-framework';
import type { ConfigObject } from '../../config-schema';
import { useTestFavoritesActions } from './test-favorites.hook';
import styles from './test-favorites.scss';

interface TestFavoritesListProps {
  orderTypeUuid: string;
  orderTypeDisplay?: string;
  isSearching?: boolean;
  openOrderForm: (concept: { uuid: string; display: string }) => void;
}

const TestFavoritesList: React.FC<TestFavoritesListProps> = ({
  orderTypeUuid,
  orderTypeDisplay,
  isSearching = false,
  openOrderForm,
}) => {
  const { t } = useTranslation();
  const { enableTestOrderFavorites } = useConfig<ConfigObject>();
  const isTablet = useLayoutType() === 'tablet';
  const { favorites, error, isLoading, removeFavorite } = useTestFavoritesActions();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    setIsCollapsed(isSearching);
  }, [isSearching]);

  if (!enableTestOrderFavorites) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <SkeletonText heading width="200px" />
        <div className={styles.skeletonCards}>
          <SkeletonText width="100%" />
          <SkeletonText width="100%" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <InlineNotification
          kind="error"
          lowContrast
          title={t('errorLoadingFavorites', 'Error loading pinned orders')}
          hideCloseButton
        />
      </div>
    );
  }

  const typeFavorites = favorites.filter((f) => f.orderTypeUuid === orderTypeUuid);

  if (typeFavorites.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>
          {t('myPinnedTestOrders', 'My pinned {{orderType}} orders', {
            orderType: (orderTypeDisplay ?? t('test', 'test')).toLocaleLowerCase(),
          })}
        </span>
        <IconButton
          kind="ghost"
          size="sm"
          align="left"
          label={
            isCollapsed
              ? t('expandPinnedOrders', 'Expand pinned orders')
              : t('collapsePinnedOrders', 'Collapse pinned orders')
          }
          onClick={() => setIsCollapsed((prev) => !prev)}
        >
          {isCollapsed ? <ChevronDown /> : <ChevronUp />}
        </IconButton>
      </div>
      {!isCollapsed && (
        <div className={styles.listContainer}>
          {typeFavorites.map((favorite) => (
            <div key={favorite.id} className={styles.favoriteItem}>
              <button
                type="button"
                className={styles.itemButton}
                onClick={() => openOrderForm({ uuid: favorite.conceptUuid, display: favorite.displayName })}
              >
                <div className={styles.itemContent}>
                  <p className={styles.itemTitle}>{favorite.displayName}</p>
                </div>
              </button>
              <IconButton
                kind="ghost"
                size={isTablet ? 'md' : 'sm'}
                label={t('unpinOrder', 'Unpin order')}
                align="left"
                className={styles.pinButton}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  removeFavorite(favorite);
                }}
              >
                <PinFilled className={styles.pinIcon} />
              </IconButton>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TestFavoritesList;
