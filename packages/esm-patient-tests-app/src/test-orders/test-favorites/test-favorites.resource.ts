import { useMemo } from 'react';
import useSWR from 'swr';
import { getLoggedInUser, openmrsFetch, restBaseUrl, setUserProperties } from '@openmrs/esm-framework';
import type { TestFavoriteOrder } from './types';

export const TEST_FAVORITES_PROPERTY_KEY = 'order_favorites_tests';

interface UserResponse {
  uuid: string;
  userProperties: Record<string, string>;
}

export function useTestFavorites(userUuid: string | undefined) {
  const url = userUuid ? `${restBaseUrl}/user/${userUuid}?v=custom:(uuid,userProperties)` : null;

  const { data, error, isLoading, mutate } = useSWR<{ data: UserResponse }>(url, openmrsFetch);

  const rawValue = data?.data?.userProperties?.[TEST_FAVORITES_PROPERTY_KEY];

  const favorites = useMemo((): Array<TestFavoriteOrder> => {
    if (!rawValue) return [];
    try {
      const stored: { favorites: Array<TestFavoriteOrder> } = JSON.parse(rawValue);
      return stored.favorites ?? [];
    } catch (e) {
      console.error('Error parsing test favorites:', e);
      return [];
    }
  }, [rawValue]);

  return { favorites, error, isLoading, mutate };
}

export async function saveTestFavorites(userUuid: string, favorites: Array<TestFavoriteOrder>) {
  const user = await getLoggedInUser();

  return setUserProperties(userUuid, {
    ...user.userProperties,
    [TEST_FAVORITES_PROPERTY_KEY]: JSON.stringify({ favorites }),
  });
}

export function getTestFavorite(
  favorites: Array<TestFavoriteOrder>,
  orderTypeUuid: string,
  conceptUuid?: string,
): TestFavoriteOrder | undefined {
  if (!conceptUuid) return undefined;
  return favorites.find((f) => f.orderTypeUuid === orderTypeUuid && f.conceptUuid === conceptUuid);
}
