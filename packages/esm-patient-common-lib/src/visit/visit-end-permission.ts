import { type Session, useSession, userHasAccess, type Visit } from '@openmrs/esm-framework';

/**
 * Lets a user end visits started at any location. Defined by the locationbasedaccess module, which also
 * enforces the same rule on the server (locationbasedaccess.access.visitEnd); this is the UI mirror of it.
 */
export const END_VISITS_AT_ANY_LOCATION_PRIVILEGE = 'End Visits At Any Location';

export interface VisitEndPermission {
  canEndVisit: boolean;
  /** Where the visit was started, for telling the user where to log in instead. */
  visitLocationName: string | null;
}

/**
 * A visit can only be ended from a session logged in at the visit's own location (exact match), unless
 * the user is a System Developer or holds END_VISITS_AT_ANY_LOCATION_PRIVILEGE. A visit with no location
 * is not restricted.
 */
export function getVisitEndPermission(
  visit: Pick<Visit, 'location'> | null | undefined,
  session: Session | null | undefined,
): VisitEndPermission {
  const visitLocationUuid = visit?.location?.uuid;
  const visitLocationName = visit?.location?.display ?? visit?.location?.name ?? null;
  if (!visitLocationUuid) {
    return { canEndVisit: true, visitLocationName };
  }
  if (session?.user && userHasAccess(END_VISITS_AT_ANY_LOCATION_PRIVILEGE, session.user)) {
    return { canEndVisit: true, visitLocationName };
  }
  return { canEndVisit: visitLocationUuid === session?.sessionLocation?.uuid, visitLocationName };
}

export function useVisitEndPermission(visit: Pick<Visit, 'location'> | null | undefined): VisitEndPermission {
  const session = useSession();
  return getVisitEndPermission(visit, session);
}
