import React from 'react';
import { SWRConfig } from 'swr';
import { renderHook, waitFor } from '@testing-library/react';
import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { type OBSERVATION_INTERPRETATION } from '@openmrs/esm-patient-common-lib';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { type ConfigObject } from '../../config-schema';
import { type TreeNode } from '../filter/filter-types';
import { computeTrendlineData, useObstreeData } from './trendline-resource';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('computeTrendlineData', () => {
  it('resolves observation-level reference ranges for each observation', () => {
    const tree: TreeNode = {
      display: 'Root',
      flatName: 'Root',
      subSets: [
        {
          display: 'Hemoglobin',
          flatName: 'Hemoglobin',
          units: 'g/dL',
          hiNormal: 9,
          lowNormal: 5,
          obs: [
            {
              obsDatetime: '2022-05-01T00:00:00.000Z',
              value: '8',
              interpretation: 'NORMAL' as OBSERVATION_INTERPRETATION,
              lowNormal: 10,
              hiNormal: 12,
            },
            {
              obsDatetime: '2023-05-01T00:00:00.000Z',
              value: '9',
              interpretation: 'NORMAL' as OBSERVATION_INTERPRETATION,
              lowNormal: 14,
              hiNormal: 18,
            },
          ],
        },
      ],
    } as TreeNode;

    const [node] = computeTrendlineData(tree);

    // Each observation should have its own resolved reference range
    expect(node.obs[0].lowNormal).toBe(10);
    expect(node.obs[0].hiNormal).toBe(12);
    expect(node.obs[1].lowNormal).toBe(14);
    expect(node.obs[1].hiNormal).toBe(18);
  });

  it('falls back to concept-level ranges when observation has no range', () => {
    const tree: TreeNode = {
      display: 'Root',
      flatName: 'Root',
      subSets: [
        {
          display: 'Hemoglobin',
          flatName: 'Hemoglobin',
          units: 'g/dL',
          hiNormal: 9,
          lowNormal: 5,
          obs: [
            {
              obsDatetime: '2022-05-01T00:00:00.000Z',
              value: '8',
              interpretation: 'NORMAL' as OBSERVATION_INTERPRETATION,
              // No observation-level range
            },
          ],
        },
      ],
    } as TreeNode;

    const [node] = computeTrendlineData(tree);

    // Should fall back to concept-level ranges
    expect(node.obs[0].lowNormal).toBe(5);
    expect(node.obs[0].hiNormal).toBe(9);
  });

  it('uses observation-level critical ranges even when normal ranges are missing', () => {
    const tree: TreeNode = {
      display: 'Root',
      flatName: 'Root',
      subSets: [
        {
          display: 'Hemoglobin',
          flatName: 'Hemoglobin',
          units: 'g/dL',
          hiNormal: 9,
          lowNormal: 5,
          obs: [
            {
              obsDatetime: '2022-05-01T00:00:00.000Z',
              value: '201',
              interpretation: 'NORMAL' as OBSERVATION_INTERPRETATION,
              lowCritical: 2,
              hiCritical: 200,
            },
          ],
        },
      ],
    } as TreeNode;

    const [node] = computeTrendlineData(tree);

    expect(node.obs[0].lowCritical).toBe(2);
    expect(node.obs[0].hiCritical).toBe(200);
  });
});

describe('useObstreeData for a range test', () => {
  const rangeTestUuid = '4881482b-0cc7-4201-8ce9-39f00e1fd5a4';
  // /obstree for a range test: the range test with its Lower and Upper bounds, in concept set order
  const rangeTree = {
    display: 'Range Test',
    subSets: [
      {
        display: 'Range Test Lower',
        conceptUuid: 'lower-uuid',
        units: 'mg/dL',
        lowNormal: 90,
        hiNormal: 110,
        obs: [{ obsDatetime: '2024-02-01T10:00:00.000Z', value: '100' }],
      },
      {
        display: 'Range Test Upper',
        conceptUuid: 'upper-uuid',
        units: 'mg/dL',
        lowNormal: 100,
        hiNormal: 115,
        obs: [{ obsDatetime: '2024-02-01T10:00:00.000Z', value: '120' }],
      },
    ],
  };
  const wrapper = ({ children }) => <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>;

  afterEach(() => {
    mockUseConfig.mockReturnValue({} as ConfigObject);
  });

  it('returns the merged range and both bounds so they can be plotted as two lines', async () => {
    mockUseConfig.mockReturnValue({ rangeResultConcepts: [rangeTestUuid] } as ConfigObject);
    mockOpenmrsFetch.mockResolvedValue({ data: rangeTree } as any);

    const { result } = renderHook(() => useObstreeData('patient-uuid', rangeTestUuid), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rangeBounds.map((bound) => bound.display)).toEqual(['Range Test Lower', 'Range Test Upper']);
    expect(result.current.trendlineData).toEqual(
      expect.objectContaining({ display: 'Range Test', units: 'mg/dL', lowNormal: 90, hiNormal: 110 }),
    );
    expect(result.current.trendlineData.obs).toEqual([
      expect.objectContaining({ obsDatetime: '2024-02-01T10:00:00.000Z', value: '100 – 120', interpretation: 'HIGH' }),
    ]);
  });

  it('keeps the first test only when the concept is not a configured range test', async () => {
    mockUseConfig.mockReturnValue({ rangeResultConcepts: [] } as ConfigObject);
    mockOpenmrsFetch.mockResolvedValue({ data: rangeTree } as any);

    const { result } = renderHook(() => useObstreeData('patient-uuid', rangeTestUuid), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rangeBounds).toBeUndefined();
    expect(result.current.trendlineData.display).toBe('Range Test Lower');
  });
});
