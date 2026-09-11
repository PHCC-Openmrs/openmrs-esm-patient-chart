import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { getDefaultsFromConfigSchema, openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { configSchema, type ConfigObject } from '../config-schema';
import { useNursingRecords } from './data.resource';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const config = getDefaultsFromConfigSchema(configSchema) as ConfigObject;
const { concepts } = config;

const patientUuid = 'patient-uuid';

/**
 * Every case here requests the same URL, so each needs its own SWR cache -- otherwise the
 * first case's response is served from cache to the rest of them.
 */
const swrWrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(SWRConfig, { value: { dedupingInterval: 0, provider: () => new Map() } }, children);

const renderUseNursingRecords = () => renderHook(() => useNursingRecords(patientUuid), { wrapper: swrWrapper });

function encounterWith(uuid: string, encounterDatetime: string, obs: Array<unknown>) {
  return { uuid, encounterDatetime, obs };
}

beforeEach(() => {
  mockUseConfig.mockReturnValue(config);
});

describe('useNursingRecords', () => {
  it('flattens a nursing encounter into the fields the widgets render', async () => {
    mockOpenmrsFetch.mockResolvedValue({
      data: {
        results: [
          encounterWith('encounter-1', '2026-09-10T10:00:00.000+0000', [
            { uuid: 'obs-1', concept: { uuid: concepts.typeOfWoundUuid, display: 'Type of Wound' }, value: 'Abrasion' },
            {
              uuid: 'obs-2',
              concept: { uuid: concepts.dressingGeneralNotesUuid, display: 'Dressing General Notes' },
              value: 'Healing well',
            },
            { uuid: 'obs-3', concept: { uuid: concepts.spirometryUuid, display: 'Spirometry' }, value: 12.5 },
            { uuid: 'obs-4', concept: { uuid: concepts.monofilamentUuid, display: 'Monofilament' }, value: 3 },
            {
              uuid: 'obs-5',
              concept: { uuid: concepts.ecgImageUuid, display: 'ECG Image' },
              value: 'attachment-uuid',
            },
            {
              uuid: 'obs-6',
              concept: { uuid: concepts.imInjectionUuid, display: 'IM Injection' },
              value: 'Ceftriaxone',
            },
          ]),
        ],
      },
    } as never);

    const { result } = renderUseNursingRecords();

    await waitFor(() => expect(result.current.records).toBeDefined());

    expect(result.current.records).toEqual([
      {
        id: 'encounter-1',
        date: '2026-09-10T10:00:00.000+0000',
        ointments: [],
        typeOfWound: 'Abrasion',
        dressingGeneralNotes: 'Healing well',
        spirometry: 12.5,
        monofilament: 3,
        ecgImage: 'attachment-uuid',
        imInjection: 'Ceftriaxone',
      },
    ]);
  });

  it('collects every coded Ointment obs on an encounter into one multi-valued field', async () => {
    mockOpenmrsFetch.mockResolvedValue({
      data: {
        results: [
          encounterWith('encounter-1', '2026-09-10T10:00:00.000+0000', [
            {
              uuid: 'obs-1',
              concept: { uuid: concepts.ointmentUuid, display: 'Ointment' },
              value: { uuid: 'fucidin-uuid', display: 'Fucidin' },
            },
            {
              uuid: 'obs-2',
              concept: { uuid: concepts.ointmentUuid, display: 'Ointment' },
              value: { uuid: 'silver-uuid', display: 'Silver' },
            },
          ]),
        ],
      },
    } as never);

    const { result } = renderUseNursingRecords();

    await waitFor(() => expect(result.current.records).toBeDefined());

    expect(result.current.records[0].ointments).toEqual(['Fucidin', 'Silver']);
  });

  it('returns records newest first regardless of the order the server sends them in', async () => {
    mockOpenmrsFetch.mockResolvedValue({
      data: {
        results: [
          encounterWith('older', '2026-09-01T10:00:00.000+0000', []),
          encounterWith('newer', '2026-09-10T10:00:00.000+0000', []),
        ],
      },
    } as never);

    const { result } = renderUseNursingRecords();

    await waitFor(() => expect(result.current.records).toBeDefined());

    expect(result.current.records.map((record) => record.id)).toEqual(['newer', 'older']);
  });

  it('ignores observations whose concept is not one of the configured nursing concepts', async () => {
    mockOpenmrsFetch.mockResolvedValue({
      data: {
        results: [
          encounterWith('encounter-1', '2026-09-10T10:00:00.000+0000', [
            { uuid: 'obs-1', concept: { uuid: 'some-other-concept', display: 'Weight' }, value: 70 },
          ]),
        ],
      },
    } as never);

    const { result } = renderUseNursingRecords();

    await waitFor(() => expect(result.current.records).toBeDefined());

    expect(result.current.records).toEqual([
      { id: 'encounter-1', date: '2026-09-10T10:00:00.000+0000', ointments: [] },
    ]);
  });
});
