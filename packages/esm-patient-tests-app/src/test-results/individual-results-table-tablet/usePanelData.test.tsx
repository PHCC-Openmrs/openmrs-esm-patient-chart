import React from 'react';
import { SWRConfig } from 'swr';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { type ConfigObject } from '../../config-schema';
import usePanelData from './usePanelData';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const rangeTestUuid = '4881482b-0cc7-4201-8ce9-39f00e1fd5a4';
const lowerUuid = 'c0eb98e9-dae8-4b82-8b11-20d87c63eac1';
const upperUuid = '6ae28db0-135b-4443-a330-e9b4ea45f6c2';
const bloodPressureUuid = 'blood-pressure-uuid';
const systolicUuid = '5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const diastolicUuid = '5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

const observation = (id: string, conceptUuid: string, display: string, extra: object) => ({
  resourceType: 'Observation',
  id,
  code: { coding: [{ code: conceptUuid, display }] },
  effectiveDateTime: '2024-02-01T10:00:00+00:00',
  ...extra,
});

const observations = [
  // FHIR lists the members in obs group order, which here is not concept set order
  observation('range-obs', rangeTestUuid, 'Range Test', {
    valueString: '100, 120',
    hasMember: [{ reference: 'Observation/upper-obs' }, { reference: 'Observation/lower-obs' }],
  }),
  observation('upper-obs', upperUuid, 'Range Test Upper', { valueQuantity: { value: 120 } }),
  observation('lower-obs', lowerUuid, 'Range Test Lower', { valueQuantity: { value: 100 } }),
  observation('bp-obs', bloodPressureUuid, 'Blood pressure', {
    valueString: '120, 80',
    hasMember: [{ reference: 'Observation/systolic-obs' }, { reference: 'Observation/diastolic-obs' }],
  }),
  observation('systolic-obs', systolicUuid, 'Systolic', { valueQuantity: { value: 120 } }),
  observation('diastolic-obs', diastolicUuid, 'Diastolic', { valueQuantity: { value: 80 } }),
];

const numeric = { display: 'Numeric', hl7Abbreviation: 'NM' };
const labSet = (uuid: string, display: string, members: Array<string>) => ({
  uuid,
  display,
  conceptClass: { display: 'LabSet' },
  datatype: { display: 'N/A' },
  setMembers: members.map((memberUuid) => ({ uuid: memberUuid, datatype: numeric })),
});
const test = (uuid: string, display: string, lowNormal: number, hiNormal: number) => ({
  uuid,
  display,
  conceptClass: { display: 'Test' },
  datatype: numeric,
  setMembers: [],
  lowNormal,
  hiNormal,
  units: 'mg/dL',
});

const concepts = {
  [rangeTestUuid]: labSet(rangeTestUuid, 'Range Test', [lowerUuid, upperUuid]),
  [lowerUuid]: test(lowerUuid, 'Range Test Lower', 90, 110),
  [upperUuid]: test(upperUuid, 'Range Test Upper', 100, 115),
  [bloodPressureUuid]: labSet(bloodPressureUuid, 'Blood pressure', [systolicUuid, diastolicUuid]),
  [systolicUuid]: test(systolicUuid, 'Systolic', 90, 140),
  [diastolicUuid]: test(diastolicUuid, 'Diastolic', 60, 90),
};

const wrapper = ({ children }) => <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>;

describe('usePanelData', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockImplementation((url: string) => {
      const conceptUuid = /\/concept\/([^?]+)/.exec(url)?.[1];
      const data = conceptUuid
        ? concepts[conceptUuid]
        : { link: [], entry: observations.map((resource) => ({ resource })) };
      return Promise.resolve({ data } as any);
    });
  });

  afterEach(() => {
    mockUseConfig.mockReturnValue({} as ConfigObject);
  });

  const loadPanels = async () => {
    const { result } = renderHook(() => usePanelData('patient-uuid'), { wrapper });
    await waitFor(() => expect(Object.keys(result.current.conceptData)).toHaveLength(6));
    return result.current.panels;
  };

  it('gives a range test one "100 – 120" result with the lower bound reference range and worst flag', async () => {
    mockUseConfig.mockReturnValue({ rangeResultConcepts: [rangeTestUuid] } as ConfigObject);

    const panels = await loadPanels();
    const rangePanel = panels.find((panel) => panel.conceptUuid === rangeTestUuid);

    expect(rangePanel.value).toBe('100 – 120 mg/dL');
    expect(rangePanel.meta.range).toBe('90 – 110');
    expect(rangePanel.interpretation).toBe('HIGH');
    expect(rangePanel.relatedObs.map((obs) => obs.id)).toEqual(['upper-obs', 'lower-obs']);
  });

  it('leaves a two-member panel that is not a configured range test unchanged', async () => {
    mockUseConfig.mockReturnValue({ rangeResultConcepts: [rangeTestUuid] } as ConfigObject);

    const panels = await loadPanels();
    const bloodPressure = panels.find((panel) => panel.conceptUuid === bloodPressureUuid);

    expect(bloodPressure.value).toBe('120, 80');
    expect(bloodPressure.relatedObs.map((obs) => obs.id)).toEqual(['systolic-obs', 'diastolic-obs']);
  });

  it('leaves the range test unchanged when it is not configured', async () => {
    mockUseConfig.mockReturnValue({ rangeResultConcepts: [] } as ConfigObject);

    const panels = await loadPanels();

    expect(panels.find((panel) => panel.conceptUuid === rangeTestUuid).value).toBe('100, 120');
  });
});
