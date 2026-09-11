import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
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

vi.mock('../utils', () => ({
  useLaunchNursingForm: () => vi.fn(),
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
});
