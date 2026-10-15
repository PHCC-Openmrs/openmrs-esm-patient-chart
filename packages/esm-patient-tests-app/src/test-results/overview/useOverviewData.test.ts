import { describe, it, expect } from 'vitest';
import { type ObsRecord } from '@openmrs/esm-patient-common-lib';
import { parseSingleEntry } from './useOverviewData';

const rangeTestUuid = '4881482b-0cc7-4201-8ce9-39f00e1fd5a4';

const member = (id: string, name: string, value: string, interpretation: string, range?: string) =>
  ({
    id,
    name,
    value,
    interpretation,
    meta: { units: 'mg/dL', range },
  }) as unknown as ObsRecord;

const panel = (conceptClass: string, members: Array<ObsRecord>) =>
  ({
    id: 'panel-obs-uuid',
    conceptClass,
    members,
  }) as unknown as ObsRecord;

describe('parseSingleEntry', () => {
  it('merges the two members of a range test into one row', () => {
    const entry = panel(rangeTestUuid, [
      member('lower-obs', 'Range Test Lower', '100', 'NORMAL', '90 – 110'),
      member('upper-obs', 'Range Test Upper', '120', 'CRITICALLY_HIGH', '100 – 115'),
    ]);

    expect(parseSingleEntry(entry, 'LabSet', 'Range Test', [rangeTestUuid])).toEqual([
      {
        id: 'panel-obs-uuid',
        key: 'panel-obs-uuid',
        name: 'Range Test',
        range: '90 – 110',
        interpretation: 'CRITICALLY_HIGH',
        value: { value: '100 – 120 mg/dL', interpretation: 'CRITICALLY_HIGH' },
      },
    ]);
  });

  it('shows a missing bound as "?"', () => {
    const entry = panel(rangeTestUuid, [member('lower-obs', 'Range Test Lower', '100', 'LOW', '90 – 110'), undefined]);

    const [row] = parseSingleEntry(entry, 'LabSet', 'Range Test', [rangeTestUuid]);

    expect(row.value).toEqual({ value: '100 – ? mg/dL', interpretation: 'LOW' });
  });

  it('keeps one row per member for a two-member panel that is not a configured range test', () => {
    const entry = panel('blood-pressure-uuid', [
      member('systolic-obs', 'Systolic', '120', 'NORMAL'),
      member('diastolic-obs', 'Diastolic', '80', 'NORMAL'),
    ]);

    const rows = parseSingleEntry(entry, 'LabSet', 'Blood pressure', [rangeTestUuid]);

    expect(rows.map(({ name, value }) => [name, value.value])).toEqual([
      ['Systolic', '120'],
      ['Diastolic', '80'],
    ]);
  });

  it('keeps one row per member when no range tests are configured', () => {
    const entry = panel(rangeTestUuid, [
      member('lower-obs', 'Range Test Lower', '100', 'NORMAL'),
      member('upper-obs', 'Range Test Upper', '120', 'NORMAL'),
    ]);

    expect(parseSingleEntry(entry, 'LabSet', 'Range Test')).toHaveLength(2);
  });
});
