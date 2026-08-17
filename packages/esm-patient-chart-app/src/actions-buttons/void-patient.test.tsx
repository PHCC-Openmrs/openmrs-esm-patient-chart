import React from 'react';
import { vi, describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, render } from '@testing-library/react';
import { showModal, useSession, userHasAccess } from '@openmrs/esm-framework';
import VoidPatientOverflowMenuItem from './void-patient.component';

const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockShowModal = vi.mocked(showModal);

describe('VoidPatientOverflowMenuItem', () => {
  it('renders and launches the delete-patient dialog when the user has the Delete Patients privilege', async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({ user: { uuid: 'admin-uuid' } } as ReturnType<typeof useSession>);
    mockUserHasAccess.mockReturnValueOnce(true);

    render(<VoidPatientOverflowMenuItem patientUuid="some-uuid" />);

    const deletePatientButton = screen.getByRole('menuitem', { name: /delete patient/i });
    expect(deletePatientButton).toBeInTheDocument();

    await user.click(deletePatientButton);
    expect(mockShowModal).toHaveBeenCalledWith(
      'void-patient-dialog',
      expect.objectContaining({ patientUuid: 'some-uuid' }),
    );
  });

  it('does not render for a user without the Delete Patients privilege', () => {
    mockUseSession.mockReturnValue({ user: { uuid: 'nurse-uuid' } } as ReturnType<typeof useSession>);
    mockUserHasAccess.mockReturnValueOnce(false);

    render(<VoidPatientOverflowMenuItem patientUuid="some-uuid" />);

    expect(screen.queryByRole('menuitem', { name: /delete patient/i })).not.toBeInTheDocument();
  });
});
