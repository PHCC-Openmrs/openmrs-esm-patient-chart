import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { renderWithSwr, waitForLoadingToFinish } from 'tools';
import { configSchema, type ConfigObject } from '../config-schema';
import { useNursingRecords } from '../common';
import { type NursingRecord } from '../common/types';
import OtherMeasuresOverview from './other-measures-overview.component';

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

describe('OtherMeasuresOverview', () => {
  it('renders an empty state when the patient has no other measures', async () => {
    mockRecords([]);

    renderWithSwr(<OtherMeasuresOverview patientUuid="patient-uuid" />);
    await waitForLoadingToFinish();

    expect(screen.getByRole('heading', { name: /other measures/i })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders the measurements with their units and links to the ECG attachment', async () => {
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

    renderWithSwr(<OtherMeasuresOverview patientUuid="patient-uuid" />);
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

  it('leaves out encounters that recorded no other measures', async () => {
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
        spirometry: 0,
      },
    ]);

    renderWithSwr(<OtherMeasuresOverview patientUuid="patient-uuid" />);
    await waitForLoadingToFinish();

    expect(screen.getAllByRole('row')).toHaveLength(2); // header + the one encounter with a measurement
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
