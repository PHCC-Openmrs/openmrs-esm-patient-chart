import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openmrsFetch } from '@openmrs/esm-framework';
import { type Order } from '@openmrs/esm-patient-common-lib';
import { type Observation } from '../types/encounter';
import {
  createCompositeObservationPayload,
  createObservationSaveTasks,
  flattenPanelResults,
  type LabOrderConcept,
} from './lab-results.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const numeric = { uuid: 'NM', display: 'Numeric', name: 'Numeric', hl7Abbreviation: 'NM' };
const text = { uuid: 'ST', display: 'Text', name: 'Text', hl7Abbreviation: 'ST' };
const na = { uuid: 'ZZ', display: 'N/A', name: 'N/A', hl7Abbreviation: 'ZZ' };

const leaf = (uuid: string, datatype = numeric) =>
  ({ uuid, display: uuid, datatype, set: false, setMembers: [] }) as unknown as LabOrderConcept;
const panel = (uuid: string, setMembers: Array<LabOrderConcept>) =>
  ({ uuid, display: uuid, datatype: na, set: true, setMembers }) as unknown as LabOrderConcept;

// Urine Analysis -> physical (colour, ph) / chemical (protein)
const colour = leaf('colour', text);
const ph = leaf('ph');
const protein = leaf('protein');
const physical = panel('physical', [colour, ph]);
const chemical = panel('chemical', [protein]);
const urineAnalysis = panel('urine-analysis', [physical, chemical]);

const order = {
  uuid: 'order-1',
  concept: { uuid: 'urine-analysis' },
  patient: { uuid: 'patient-1' },
  encounter: { uuid: 'encounter-1' },
} as unknown as Order;

const obs = (uuid: string, conceptUuid: string, rest: Partial<Observation> = {}) =>
  ({ uuid, concept: { uuid: conceptUuid }, ...rest }) as unknown as Observation;

describe('createCompositeObservationPayload', () => {
  it('saves tests inside sub-panels as group members of their own sub-panel obs', () => {
    const { obs: payload } = createCompositeObservationPayload(
      [urineAnalysis],
      order,
      { colour: 'Yellow', ph: 6, protein: 1 },
      'FINAL',
    );

    expect(payload).toHaveLength(1);
    expect(payload[0]).toMatchObject({ concept: { uuid: 'urine-analysis' }, order: { uuid: 'order-1' } });
    const [physicalObs, chemicalObs] = (payload[0] as any).groupMembers;
    expect(physicalObs.concept.uuid).toBe('physical');
    expect(physicalObs.groupMembers.map((m) => [m.concept.uuid, m.value])).toEqual([
      ['colour', 'Yellow'],
      ['ph', 6],
    ]);
    expect(chemicalObs.groupMembers.map((m) => [m.concept.uuid, m.value])).toEqual([['protein', 1]]);
  });

  it('leaves out sub-panels that have no values', () => {
    const { obs: payload } = createCompositeObservationPayload([urineAnalysis], order, { protein: 1 }, 'FINAL');

    const members = (payload[0] as any).groupMembers;
    expect(members).toHaveLength(1);
    expect(members[0].concept.uuid).toBe('chemical');
  });

  it('returns no obs when nothing is filled in', () => {
    expect(createCompositeObservationPayload([urineAnalysis], order, {}, 'FINAL')).toEqual({ obs: [] });
  });

  it('still handles a plain one-level panel and a single test', () => {
    const { obs: payload } = createCompositeObservationPayload(
      [physical, ph],
      order,
      { colour: 'Pale', ph: 5 },
      'FINAL',
    );

    expect(payload).toHaveLength(2);
    expect((payload[0] as any).groupMembers).toHaveLength(2);
    expect(payload[1]).toMatchObject({ concept: { uuid: 'ph' }, value: 5 });
  });
});

describe('createObservationSaveTasks', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
    mockOpenmrsFetch.mockResolvedValue({ ok: true } as any);
  });

  const saved = obs('obs-root', 'urine-analysis', {
    groupMembers: [
      obs('obs-physical', 'physical', { groupMembers: [obs('obs-colour', 'colour'), obs('obs-ph', 'ph')] }),
      obs('obs-chemical', 'chemical', { groupMembers: [obs('obs-protein', 'protein')] }),
    ],
  });

  it('updates existing obs however deeply they are nested', async () => {
    const tasks = createObservationSaveTasks([urineAnalysis], [saved], order, { colour: 'Red', ph: 7, protein: 2 });

    expect(tasks.map((t) => t.conceptUuid)).toEqual(['colour', 'ph', 'protein']);
    await Promise.all(tasks.map((t) => t.save()));

    const calls = mockOpenmrsFetch.mock.calls.map(([url, init]) => [url, JSON.parse((init as any).body)]);
    expect(calls).toEqual([
      [expect.stringContaining('/obs/obs-colour'), { value: 'Red' }],
      [expect.stringContaining('/obs/obs-ph'), { value: 7 }],
      [expect.stringContaining('/obs/obs-protein'), { value: 2 }],
    ]);
  });

  it('re-saves the whole result and voids the old one when a filled field has no obs yet', async () => {
    const withoutChemical = obs('obs-root', 'urine-analysis', {
      groupMembers: [obs('obs-physical', 'physical', { groupMembers: [obs('obs-colour', 'colour')] })],
    });

    const tasks = createObservationSaveTasks([urineAnalysis], [withoutChemical], order, {
      colour: 'Red',
      ph: 7,
      protein: 2,
    });
    expect(tasks.map((t) => t.conceptUuid)).toEqual(['urine-analysis']);
    await tasks[0].save();

    const [[createUrl, createInit], [voidUrl, voidInit]] = mockOpenmrsFetch.mock.calls;
    expect(createUrl).toContain('/encounter/encounter-1');
    const [root] = JSON.parse((createInit as any).body).obs;
    expect(root.groupMembers.map((g) => g.concept.uuid)).toEqual(['physical', 'chemical']);
    expect(root.groupMembers[0].groupMembers.map((m) => [m.concept.uuid, m.value])).toEqual([
      ['colour', 'Red'],
      ['ph', 7],
    ]);
    expect(root.groupMembers[1].groupMembers.map((m) => [m.concept.uuid, m.value])).toEqual([['protein', 2]]);
    // the old result is only voided after the new one has been stored
    expect(voidUrl).toContain('/obs/obs-root');
    expect((voidInit as any).method).toBe('DELETE');
  });

  it('does not void the old result if saving the new one fails', async () => {
    mockOpenmrsFetch.mockRejectedValueOnce(new Error('boom'));
    const tasks = createObservationSaveTasks([urineAnalysis], [obs('obs-root', 'urine-analysis')], order, { ph: 7 });

    await expect(tasks[0].save()).rejects.toThrow('boom');
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
  });

  it('creates the whole result when the order was completed with no obs saved', async () => {
    const tasks = createObservationSaveTasks([urineAnalysis], [], order, { colour: 'Red' });
    await Promise.all(tasks.map((t) => t.save()));

    expect(tasks).toHaveLength(1);
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
    const [root] = JSON.parse((mockOpenmrsFetch.mock.calls[0][1] as any).body).obs;
    expect(root).toMatchObject({ concept: { uuid: 'urine-analysis' }, order: { uuid: 'order-1' } });
    expect(root.groupMembers[0].groupMembers[0]).toMatchObject({ concept: { uuid: 'colour' }, value: 'Red' });
  });

  it('skips fields left empty', () => {
    expect(createObservationSaveTasks([urineAnalysis], [saved], order, { colour: '', ph: undefined })).toEqual([]);
  });
});

describe('flattenPanelResults', () => {
  it('lists sub-panel headings followed by their own tests', () => {
    const rows = flattenPanelResults(
      urineAnalysis,
      obs('obs-root', 'urine-analysis', {
        groupMembers: [obs('obs-physical', 'physical', { groupMembers: [obs('obs-colour', 'colour')] })],
      }),
    );

    expect(rows.map((r) => [r.concept.uuid, r.isHeading, r.obs?.uuid])).toEqual([
      ['physical', true, 'obs-physical'],
      ['colour', false, 'obs-colour'],
      ['ph', false, undefined],
      ['chemical', true, undefined],
      ['protein', false, undefined],
    ]);
  });
});
