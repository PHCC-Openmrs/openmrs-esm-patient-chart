import { describe, expect, it, vi, beforeEach } from 'vitest';
import { type Session, userHasAccess } from '@openmrs/esm-framework';
import { END_VISITS_AT_ANY_LOCATION_PRIVILEGE, getVisitEndPermission } from './visit-end-permission';

const mockUserHasAccess = vi.mocked(userHasAccess);

const siteA = { uuid: 'site-a', display: 'Deir Al-Balah PHCC', name: 'Deir Al-Balah PHCC' };

function sessionAt(locationUuid: string | null) {
  return {
    authenticated: true,
    sessionId: 'session',
    user: { uuid: 'user', privileges: [], roles: [] },
    sessionLocation: locationUuid ? { uuid: locationUuid, display: locationUuid } : undefined,
  } as unknown as Session;
}

describe('getVisitEndPermission', () => {
  beforeEach(() => {
    mockUserHasAccess.mockReturnValue(false);
  });

  it('allows ending a visit from its own location', () => {
    expect(getVisitEndPermission({ location: siteA }, sessionAt('site-a'))).toEqual({
      canEndVisit: true,
      visitLocationName: 'Deir Al-Balah PHCC',
    });
  });

  it('refuses ending a visit from a different location and names where it was started', () => {
    expect(getVisitEndPermission({ location: siteA }, sessionAt('site-b'))).toEqual({
      canEndVisit: false,
      visitLocationName: 'Deir Al-Balah PHCC',
    });
  });

  it('refuses when the session has no location', () => {
    expect(getVisitEndPermission({ location: siteA }, sessionAt(null)).canEndVisit).toBe(false);
  });

  it('allows users with the any-location privilege (or System Developers)', () => {
    mockUserHasAccess.mockImplementation((privilege) => privilege === END_VISITS_AT_ANY_LOCATION_PRIVILEGE);
    expect(getVisitEndPermission({ location: siteA }, sessionAt('site-b')).canEndVisit).toBe(true);
  });

  it('does not restrict a visit without a location, or no visit at all', () => {
    expect(getVisitEndPermission({ location: undefined }, sessionAt('site-b')).canEndVisit).toBe(true);
    expect(getVisitEndPermission(null, sessionAt('site-b')).canEndVisit).toBe(true);
  });
});
