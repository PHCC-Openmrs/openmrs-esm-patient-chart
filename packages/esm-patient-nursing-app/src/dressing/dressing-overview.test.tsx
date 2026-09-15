import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { renderWithSwr, waitForLoadingToFinish } from 'tools';
import { configSchema, type ConfigObject } from '../config-schema';
import { useNursingRecords } from '../common';
import { type NursingRecord } from '../common/types';
import DressingOverview from './dressing-overview.component';

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

describe('DressingOverview', () => {
  it('renders an empty state when the patient has no dressing or other measure records', async () => {
    mockRecords([]);

    renderWithSwr(<DressingOverview patientUuid="patient-uuid" />);
    await waitForLoadingToFinish();

    expect(screen.getByRole('heading', { name: /dressing and other measures/i })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders every dressing detail recorded on an encounter', async () => {
    mockRecords([
      {
        id: 'encounter-1',
        date: '2026-09-10T10:00:00.000+0000',
        ointments: ['Fucidin', 'Calmex'],
        typeOfWound: 'Abrasion',
        dressingGeneralNotes: 'Cleaned and redressed',
      },
    ]);

    renderWithSwr(<DressingOverview patientUuid="patient-uuid" />);
    await waitForLoadingToFinish();

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Abrasion')).toBeInTheDocument();
    expect(screen.getByText('Fucidin')).toBeInTheDocument();
    expect(screen.getByText('Calmex')).toBeInTheDocument();
    expect(screen.getByText('Cleaned and redressed')).toBeInTheDocument();
  });

  it('shows a record whose only dressing detail is an ointment', async () => {
    mockRecords([
      {
        id: 'encounter-1',
        date: '2026-09-10T10:00:00.000+0000',
        ointments: ['Calmex'],
      },
      {
        id: 'encounter-2',
        date: '2026-09-09T08:30:00.000+0000',
        ointments: [],
        oral: 'Paracetamol 500mg',
      },
    ]);

    renderWithSwr(<DressingOverview patientUuid="patient-uuid" />);
    await waitForLoadingToFinish();

    expect(screen.getAllByRole('row')).toHaveLength(2); // header + the one encounter with a dressing
    expect(screen.getByText('Calmex')).toBeInTheDocument();
  });

  it('renders the other measures with their units and links to the ECG attachment', async () => {
    mockRecords([
      {
        id: 'encounter-1',
        date: '2026-09-10T10:00:00.000+0000',
        ointments: [],
        ecgImage: 'attachment-uuid',
        spirometry: 6,
        monofilament: 4,
      },
    ]);

    renderWithSwr(<DressingOverview patientUuid="patient-uuid" />);
    await waitForLoadingToFinish();

    expect(screen.getByRole('columnheader', { name: /spirometry \(g\)/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /monofilament \(l\)/i })).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view ecg/i })).toHaveAttribute(
      'href',
      expect.stringContaining('attachment-uuid'),
    );
  });

  it('shows a record whose only detail is an other measure', async () => {
    mockRecords([
      {
        id: 'encounter-1',
        date: '2026-09-10T10:00:00.000+0000',
        ointments: [],
        spirometry: 0,
      },
    ]);

    renderWithSwr(<DressingOverview patientUuid="patient-uuid" />);
    await waitForLoadingToFinish();

    expect(screen.getAllByRole('row')).toHaveLength(2); // header + the one encounter with a measurement
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('leaves out encounters that recorded neither a dressing nor an other measure', async () => {
    mockRecords([
      {
        id: 'encounter-1',
        date: '2026-09-10T10:00:00.000+0000',
        ointments: [],
        oral: 'Paracetamol 500mg',
      },
    ]);

    renderWithSwr(<DressingOverview patientUuid="patient-uuid" />);
    await waitForLoadingToFinish();

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
