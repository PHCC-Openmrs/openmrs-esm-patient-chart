import React from 'react';
import { vi, describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { type Order, useReferenceRanges } from '@openmrs/esm-patient-common-lib';
import { configSchema, type ConfigObject } from '../config-schema';
import {
  type LabOrderConcept,
  useLabEncounter,
  useOrderConceptByUuid,
  useOrderConceptsByUuids,
} from '../lab-results/lab-results.resource';
import { type Encounter } from '../types/encounter';
import TestOrder from './test-order.component';

vi.mock('../lab-results/lab-results.resource', async () => ({
  ...((await vi.importActual('../lab-results/lab-results.resource')) as object),
  useOrderConceptByUuid: vi.fn(),
  useOrderConceptsByUuids: vi.fn(),
  useLabEncounter: vi.fn(),
}));

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...((await vi.importActual('@openmrs/esm-patient-common-lib')) as object),
  useReferenceRanges: vi.fn(),
}));

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);

const numeric = { display: 'Numeric', hl7Abbreviation: 'NM' };
const bound = (uuid: string, display: string) => ({
  uuid,
  display,
  datatype: numeric,
  setMembers: [],
  units: 'mg/dL',
  lowNormal: 90,
  hiNormal: 110,
  hiCritical: 150,
});
const rangeConcept = {
  uuid: 'range-test',
  display: 'Range Test',
  set: true,
  datatype: { display: 'N/A', hl7Abbreviation: 'ZZ' },
  setMembers: [bound('lower', 'Range Test Lower'), bound('upper', 'Range Test Upper')],
} as unknown as LabOrderConcept;

const order = {
  uuid: 'order-uuid',
  concept: { uuid: 'range-test' },
  encounter: { uuid: 'encounter-uuid' },
  orderType: { display: 'Test order' },
} as unknown as Order;

const encounterWithRange = (lowerValue: number, upperValue: number) =>
  ({
    patient: { uuid: 'patient-uuid' },
    obs: [
      {
        uuid: 'obs-range',
        order: { uuid: 'order-uuid' },
        concept: { uuid: 'range-test' },
        groupMembers: [
          { uuid: 'obs-lower', concept: { uuid: 'lower' }, value: lowerValue },
          { uuid: 'obs-upper', concept: { uuid: 'upper' }, value: upperValue },
        ],
      },
    ],
  }) as unknown as Encounter;

describe('TestOrder', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({ ...getDefaultsFromConfigSchema(configSchema), rangeResultConcepts: ['range-test'] });
    vi.mocked(useOrderConceptByUuid).mockReturnValue({ concept: rangeConcept, isLoading: false } as any);
    vi.mocked(useOrderConceptsByUuids).mockReturnValue({ concepts: [rangeConcept], isLoading: false } as any);
    vi.mocked(useLabEncounter).mockReturnValue({ encounter: encounterWithRange(100, 120), isLoading: false } as any);
    vi.mocked(useReferenceRanges).mockReturnValue({ ranges: new Map(), isLoading: false } as any);
  });

  it('shows a range test as one row with both values', () => {
    render(<TestOrder testOrder={order} patientUuid="patient-uuid" />);

    expect(screen.getByRole('cell', { name: 'Range Test' })).toBeInTheDocument();
    expect(screen.getByText('100 – 120 mg/dL')).toBeInTheDocument();
    expect(screen.queryByText('Range Test Lower')).not.toBeInTheDocument();
    expect(screen.queryByText('Range Test Upper')).not.toBeInTheDocument();
  });

  it('flags the range with its worse bound', () => {
    vi.mocked(useLabEncounter).mockReturnValue({ encounter: encounterWithRange(100, 160), isLoading: false } as any);
    render(<TestOrder testOrder={order} patientUuid="patient-uuid" />);

    expect(screen.getByRole('cell', { name: '100 – 160 mg/dL' }).className).toMatch(/critically-high/);
  });

  it('shows one row per member when the concept is not configured as a range', () => {
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema));
    render(<TestOrder testOrder={order} patientUuid="patient-uuid" />);

    expect(screen.getByText('Range Test Lower')).toBeInTheDocument();
    expect(screen.getByText('Range Test Upper')).toBeInTheDocument();
  });
});
