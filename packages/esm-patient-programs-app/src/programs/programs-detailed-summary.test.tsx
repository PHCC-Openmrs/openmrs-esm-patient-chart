import React from 'react';
import { vi, describe, it, expect, type Mock } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, within } from '@testing-library/react';
import { getDefaultsFromConfigSchema, launchWorkspace2, openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { ErrorState } from '@openmrs/esm-patient-common-lib';
import { mockPatient, renderWithSwr, waitForLoadingToFinish } from 'tools';
import { type ConfigObject, configSchema } from '../config-schema';
import ProgramsDetailedSummary from './programs-detailed-summary.component';

const mockLaunchWorkspace = vi.mocked(launchWorkspace2);
const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockOpenmrsFetch = openmrsFetch as Mock;

// Two episodes of the same program (Nutrition Registration), from two separate visits -- each
// visit's Service selection opens its own enrollment (see the start-visit form), so Care
// Services collapses them into one row per program with a visit count and a last-visited date
// rather than one row per episode.
const mockNutritionEpisodes = [
  {
    uuid: 'episode-2-uuid',
    program: {
      uuid: '2433ebba-8ffb-11f1-a103-1afee95a890c',
      display: 'Nutrition Registration',
      name: 'Nutrition Registration',
      allWorkflows: [],
    },
    display: 'Nutrition Registration',
    location: { uuid: 'de3b87c1-9688-4162-bfc5-d5eeccf3354d', display: 'Deir Al-Balah PHCC' },
    dateEnrolled: '2026-08-11T10:27:14.000+0000',
    dateCompleted: null,
    states: [],
  },
  {
    uuid: 'episode-1-uuid',
    program: {
      uuid: '2433ebba-8ffb-11f1-a103-1afee95a890c',
      display: 'Nutrition Registration',
      name: 'Nutrition Registration',
      allWorkflows: [],
    },
    display: 'Nutrition Registration',
    location: { uuid: 'de3b87c1-9688-4162-bfc5-d5eeccf3354d', display: 'Deir Al-Balah PHCC' },
    dateEnrolled: '2026-08-05T10:54:26.000+0000',
    dateCompleted: '2026-08-05T12:00:00.000+0000',
    states: [],
  },
];

describe('ProgramsDetailedSummary', () => {
  it('renders an empty state view when the patient is not enrolled into any services', async () => {
    mockOpenmrsFetch.mockReturnValueOnce({ data: { results: [] } });

    renderWithSwr(<ProgramsDetailedSummary patientUuid={mockPatient.id} />);

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

    renderWithSwr(<ProgramsDetailedSummary patientUuid={mockPatient.id} />);

    await waitForLoadingToFinish();

    expect(ErrorState).toHaveBeenCalledWith(expect.objectContaining({ error, headerTitle: 'Care Services' }), {});
  });

  it('renders one row per service, collapsing repeat visits into a count and a last date', async () => {
    const user = userEvent.setup();

    mockOpenmrsFetch.mockReturnValueOnce({ data: { results: mockNutritionEpisodes } });

    renderWithSwr(<ProgramsDetailedSummary patientUuid={mockPatient.id} />);

    await waitForLoadingToFinish();

    expect(screen.getByText(/Care Services/i)).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /active services/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /count/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /last date/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /status/i })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /date enrolled/i })).not.toBeInTheDocument();

    // No "Add" button anywhere -- services are only ever added from the start-visit form.
    expect(screen.queryByRole('button', { name: /add/i })).not.toBeInTheDocument();

    // Two episodes for the same program collapse into a single row...
    const rows = screen.getAllByRole('row', { name: /nutrition registration/i });
    expect(rows).toHaveLength(1);
    const row = rows[0];

    // ...counting both visits...
    expect(within(row).getByRole('cell', { name: '2' })).toBeInTheDocument();
    // ...showing the most recent visit's date as "Last date"...
    expect(within(row).getByRole('cell', { name: /11-Aug-2026/i })).toBeInTheDocument();
    // ...and the most recent episode's status (still active, even though the older one completed).
    expect(within(row).getByRole('cell', { name: /active$/i })).toBeInTheDocument();

    const actionMenuButton = within(row).getByRole('button', { name: /options$/i });
    expect(actionMenuButton).toBeInTheDocument();

    // The row's actions act on the most recent episode.
    await user.click(actionMenuButton);
    await user.click(screen.getByText('Edit'));

    expect(mockLaunchWorkspace).toHaveBeenCalledWith('programs-form-workspace', {
      programEnrollmentId: 'episode-2-uuid',
      workspaceTitle: 'Edit service enrollment',
    });
  });

  it('conditionally renders the service status field', async () => {
    mockOpenmrsFetch.mockReturnValueOnce({ data: { results: mockNutritionEpisodes } });

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      showProgramStatusField: true,
    });

    renderWithSwr(<ProgramsDetailedSummary patientUuid={mockPatient.id} />);

    await waitForLoadingToFinish();

    expect(screen.getByRole('columnheader', { name: /service status/i })).toBeInTheDocument();
  });
});
