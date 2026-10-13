import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { reportError, showSnackbar, useConfig, useSession } from '@openmrs/esm-framework';
import type { ConfigObject } from '../../config-schema';
import {
  TEST_FAVORITES_PROPERTY_KEY,
  getTestFavorite,
  saveTestFavorites,
  useTestFavorites,
} from './test-favorites.resource';
import type { TestFavoriteOrder } from './types';

interface SnackbarMessages {
  successTitle: string;
  successSubtitle: string;
  errorTitle: string;
}

export function useTestFavoritesActions() {
  const { t } = useTranslation();
  const { user } = useSession();
  const { favorites, error, isLoading, mutate } = useTestFavorites(user?.uuid);
  const favoritesRef = useRef(favorites);
  favoritesRef.current = favorites;

  const persistFavorites = useCallback(
    async (updatedFavorites: Array<TestFavoriteOrder>, messages: SnackbarMessages): Promise<boolean> => {
      if (!user?.uuid || isLoading) return false;

      mutate(
        (currentData) =>
          currentData
            ? {
                data: {
                  ...currentData.data,
                  userProperties: {
                    ...currentData.data.userProperties,
                    [TEST_FAVORITES_PROPERTY_KEY]: JSON.stringify({ favorites: updatedFavorites }),
                  },
                },
              }
            : currentData,
        false,
      );

      try {
        await saveTestFavorites(user.uuid, updatedFavorites);
        mutate();
        showSnackbar({
          isLowContrast: true,
          kind: 'success',
          title: messages.successTitle,
          subtitle: messages.successSubtitle,
        });
        return true;
      } catch (error: unknown) {
        mutate();
        reportError(error);
        showSnackbar({
          isLowContrast: false,
          kind: 'error',
          title: messages.errorTitle,
          subtitle: error instanceof Error ? error.message : '',
        });
        return false;
      }
    },
    [user?.uuid, isLoading, mutate],
  );

  const removeFavorite = useCallback(
    (favorite: TestFavoriteOrder) =>
      persistFavorites(
        favoritesRef.current.filter((f) => f.id !== favorite.id),
        {
          successTitle: t('orderUnpinned', 'Order unpinned'),
          successSubtitle: t('orderUnpinnedSubtitle', '{{orderName}} removed from your pinned orders', {
            orderName: favorite.displayName,
            interpolation: { escapeValue: false },
          }),
          errorTitle: t('errorUnpinningOrder', 'Error unpinning order'),
        },
      ),
    [persistFavorites, t],
  );

  return { favorites, error, isLoading, persistFavorites, removeFavorite };
}

export function useTestPinToggle(concept: { uuid: string; display: string } | undefined, orderTypeUuid: string) {
  const { t } = useTranslation();
  const { enableTestOrderFavorites, maxPinnedTestOrders } = useConfig<ConfigObject>();
  const { favorites, isLoading, persistFavorites, removeFavorite } = useTestFavoritesActions();
  const [isSaving, setIsSaving] = useState(false);

  const existing = getTestFavorite(favorites, orderTypeUuid, concept?.uuid);

  const toggle = useCallback(async () => {
    if (!concept?.uuid) {
      return;
    }

    if (existing) {
      setIsSaving(true);
      await removeFavorite(existing);
      setIsSaving(false);
      return;
    }

    if (favorites.filter((f) => f.orderTypeUuid === orderTypeUuid).length >= maxPinnedTestOrders) {
      showSnackbar({
        isLowContrast: false,
        kind: 'warning',
        title: t('maxPinnedOrdersReached', 'Maximum pinned orders reached'),
        subtitle: t('maxPinnedTestOrdersSubtitle', 'You can have a maximum of {{max}} pinned test orders', {
          max: maxPinnedTestOrders,
        }),
      });
      return;
    }

    setIsSaving(true);
    await persistFavorites(
      [
        ...favorites,
        {
          id: `${orderTypeUuid}:${concept.uuid}`,
          orderTypeUuid,
          conceptUuid: concept.uuid,
          displayName: concept.display,
        },
      ],
      {
        successTitle: t('orderPinned', 'Order pinned'),
        successSubtitle: t('orderPinnedSubtitle', '{{orderName}} added to your pinned orders', {
          orderName: concept.display,
          interpolation: { escapeValue: false },
        }),
        errorTitle: t('errorPinningOrder', 'Error pinning order'),
      },
    );
    setIsSaving(false);
  }, [concept, existing, favorites, orderTypeUuid, maxPinnedTestOrders, persistFavorites, removeFavorite, t]);

  return {
    isPinned: Boolean(existing),
    isSaving,
    isLoading,
    isEnabled: Boolean(concept && enableTestOrderFavorites),
    toggle,
  };
}
