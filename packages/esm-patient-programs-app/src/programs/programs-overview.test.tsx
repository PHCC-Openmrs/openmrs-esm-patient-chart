import React from 'react';
import { vi, describe, it, expect, type Mock } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, within } from '@testing-library/react';
import { launchWorkspace2, openmrsFetch } from '@openmrs/esm-framework';
import { ErrorState } from '@openmrs/esm-patient-common-lib';
import { mockEnrolledProgramsResponse } from '__mocks__';
import { mockPatient, renderWithSwr, waitForLoadingToFinish } from 'tools';
import ProgramsOverview from './programs-overview.component';

const mockOpenmrsFetch = openmrsFetch as Mock;
const mockLaunchWorkspace = vi.mocked(launchWorkspace2);

const testProps = {
  basePath: `/patient/${mockPatient.id}/chart`,
  patientUuid: mockPatient.id,
};

describe('ProgramsOverview', () => {
  it('renders an empty state view when the patient is not enrolled into any services', async () => {
    mockOpenmrsFetch.mockReturnValueOnce({ data: { results: [] } });

    renderWithSwr(<ProgramsOverview {...testProps} />);

    await waitForLoadingToFinish();

    expect(screen.getByText(/Care Services/i)).toBeInTheDocument();
    expect(screen.getByText(/There are no service enrollments to display for this patient/i)).toBeInTheDocument();
    // Services are now only added via the start-visit form, so the empty state offers no
    // "Add"/"Record" action.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders an error state view if there is a problem fetching service enrollments', async () => {
    const error = {
      message: 'You are not logged in',
      response: {
        status: 401,
        statusText: 'Unauthorized',
      },
    };
    mockOpenmrsFetch.mockRejectedValueOnce(error);

    renderWithSwr(<ProgramsOverview {...testProps} />);

    await waitForLoadingToFinish();

    expect(ErrorState).toHaveBeenCalledWith(expect.objectContaining({ error, headerTitle: 'Care Services' }), {});
  });

  it("renders a tabular overview of the patient's service enrollments, with no Add button", async () => {
    const user = userEvent.setup();

    mockOpenmrsFetch.mockReturnValueOnce({ data: { results: mockEnrolledProgramsResponse } });

    renderWithSwr(<ProgramsOverview {...testProps} />);

    await waitForLoadingToFinish();

    expect(screen.getByText(/Care Services/i)).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /active services/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /count/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /last date/i })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /date enrolled/i })).not.toBeInTheDocument();

    // Services are now only added via the start-visit form -- the "Add" entry point is gone
    // for every role.
    expect(screen.queryByRole('button', { name: /add/i })).not.toBeInTheDocument();

    const previousPageButton = screen.getByRole('button', { name: /previous page/i });
    const nextPageButton = screen.getByRole('button', { name: /next page/i });
    expect(nextPageButton).toBeInTheDocument();
    expect(nextPageButton).toBeDisabled();
    expect(previousPageButton).toBeInTheDocument();
    expect(previousPageButton).toBeDisabled();

    const row = screen.getByRole('row', { name: /HIV Care and Treatment/i });
    expect(row).toBeInTheDocument();
    // A single episode for this program -- Count is 1, Last date is its one dateEnrolled.
    expect(within(row).getByRole('cell', { name: '1' })).toBeInTheDocument();
    expect(within(row).getByRole('cell', { name: /16-Jan-2020/i })).toBeInTheDocument();

    const actionMenuButton = within(row).getByRole('button', { name: /options$/i });
    expect(actionMenuButton).toBeInTheDocument();

    await user.click(actionMenuButton);
    await user.click(screen.getByText('Edit'));

    expect(mockLaunchWorkspace).toHaveBeenCalledWith('programs-form-workspace', {
      programEnrollmentId: mockEnrolledProgramsResponse[0].uuid,
      workspaceTitle: 'Edit service enrollment',
    });
  });
});
