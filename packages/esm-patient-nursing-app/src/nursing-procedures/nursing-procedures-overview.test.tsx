import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultsFromConfigSchema, launchWorkspace2, useConfig, userHasAccess } from '@openmrs/esm-framework';
import { renderWithSwr, waitForLoadingToFinish } from 'tools';
import { configSchema, type ConfigObject } from '../config-schema';
import { useNursingRecords } from '../common';
import { type NursingRecord } from '../common/types';
import NursingProceduresOverview from './nursing-procedures-overview.component';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseNursingRecords = vi.mocked(useNursingRecords);

vi.mock('../common', async () => ({
  ...((await vi.importActual('../common')) as object),
  useNursingRecords: vi.fn(),
}));

const mockLaunchNursingForm = vi.fn();
const mockUseLaunchNursingForm = vi.fn((_patientUuid: string, _section?: string) => mockLaunchNursingForm);

vi.mock('../utils', () => ({
  useLaunchNursingForm: (patientUuid: string, section?: string) => mockUseLaunchNursingForm(patientUuid, section),
}));

function mockRecords(records: Array<NursingRecord>) {
  mockUseNursingRecords.mockReturnValue({
    records,
    error: null,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  } as unknown as ReturnType<typeof useNursingRecords>);
}

beforeEach(() => {
  vi.mocked(userHasAccess).mockReturnValue(true);
  mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema) as ConfigObject);
});

describe('NursingProceduresOverview', () => {
  it('renders an empty state when the patient has no nursing procedure records', async () => {
    mockRecords([]);

    renderWithSwr(<NursingProceduresOverview patientUuid="patient-uuid" />);
    await waitForLoadingToFinish();

    expect(screen.getByRole('heading', { name: /nursing procedures/i })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders the drug and quantity given for each procedure', async () => {
    mockRecords([
      {
        id: 'encounter-3',
        date: '2026-09-10T10:00:00.000+0000',
        ointments: [],
        imInjectionDrug: 'Hyoscine',
        imInjectionQty: 2,
        nebulizationDrug: 'Ipratropium (Nursing)',
        nebulizationQty: 1,
        oral: 'Paracetamol 500mg',
      },
    ]);

    renderWithSwr(<NursingProceduresOverview patientUuid="patient-uuid" />);
    await waitForLoadingToFinish();

    expect(screen.getByText('Hyoscine × 2')).toBeInTheDocument();
    expect(screen.getByText('Ipratropium (Nursing) × 1')).toBeInTheDocument();
    // an answer recorded as free text before the dropdowns existed still shows
    expect(screen.getByText('Paracetamol 500mg')).toBeInTheDocument();
  });

  it('renders every procedure recorded on an encounter', async () => {
    mockRecords([
      {
        id: 'encounter-1',
        date: '2026-09-10T10:00:00.000+0000',
        ointments: [],
        imInjection: 'Ceftriaxone 1g',
        ivInjection: 'Normal saline',
        oral: 'Paracetamol 500mg',
        nebulization: 'Salbutamol',
      },
    ]);

    renderWithSwr(<NursingProceduresOverview patientUuid="patient-uuid" />);
    await waitForLoadingToFinish();

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Ceftriaxone 1g')).toBeInTheDocument();
    expect(screen.getByText('Normal saline')).toBeInTheDocument();
    expect(screen.getByText('Paracetamol 500mg')).toBeInTheDocument();
    expect(screen.getByText('Salbutamol')).toBeInTheDocument();
  });

  it('leaves out encounters that recorded no procedure', async () => {
    mockRecords([
      {
        id: 'encounter-1',
        date: '2026-09-10T10:00:00.000+0000',
        ointments: ['Fucidin'],
        typeOfWound: 'Abrasion',
      },
      {
        id: 'encounter-2',
        date: '2026-09-09T08:30:00.000+0000',
        ointments: [],
        oral: 'Paracetamol 500mg',
      },
    ]);

    renderWithSwr(<NursingProceduresOverview patientUuid="patient-uuid" />);
    await waitForLoadingToFinish();

    expect(screen.getAllByRole('row')).toHaveLength(2); // header + the one encounter with a procedure
    expect(screen.getByText('Paracetamol 500mg')).toBeInTheDocument();
  });

  it('opens only its own sections of the nursing form from Add and Edit', async () => {
    const user = userEvent.setup();
    mockRecords([
      {
        id: 'encounter-1',
        date: '2026-09-10T10:00:00.000+0000',
        ointments: [],
        imInjectionDrug: 'Hyoscine',
        imInjectionQty: 2,
      },
    ]);

    renderWithSwr(<NursingProceduresOverview patientUuid="patient-uuid" />);
    await waitForLoadingToFinish();

    await user.click(screen.getByRole('button', { name: /add/i }));
    expect(mockUseLaunchNursingForm).toHaveBeenCalledWith('patient-uuid', 'procedures');
    expect(mockLaunchNursingForm).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /options/i }));
    await user.click(await screen.findByText('Edit'));
    expect(launchWorkspace2).toHaveBeenCalledWith(
      'patient-nursing-form-workspace',
      expect.objectContaining({ editEncounterUuid: 'encounter-1', formContext: 'editing', section: 'procedures' }),
    );
  });
});
