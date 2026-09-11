import { describe, expect, it } from 'vitest';
import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';
import { configSchema, type ConfigObject } from '../config-schema';
import { type NursingObs, type ScalarNursingField } from '../common/types';
import { buildObsForSubmission } from './nursing-form.utils';

const { concepts } = getDefaultsFromConfigSchema(configSchema) as ConfigObject;

const noExistingObs = { existingObsByField: null, existingOintmentObs: [], concepts };

function obs(uuid: string, conceptUuid: string, value: NursingObs['value']): NursingObs {
  return { uuid, concept: { uuid: conceptUuid, display: '' }, value };
}

describe('buildObsForSubmission', () => {
  describe('creating a new record', () => {
    it('writes an obs for each field that was filled in, and nothing for the rest', () => {
      const { newObs, toBeVoided } = buildObsForSubmission({
        data: { typeOfWound: 'Abrasion', imInjection: 'Ceftriaxone' },
        initialValues: {},
        ...noExistingObs,
      });

      expect(toBeVoided).toEqual([]);
      expect(newObs).toEqual([
        { concept: concepts.typeOfWoundUuid, value: 'Abrasion' },
        { concept: concepts.imInjectionUuid, value: 'Ceftriaxone' },
      ]);
    });

    it('writes numeric fields as numbers rather than strings', () => {
      const { newObs } = buildObsForSubmission({
        data: { spirometry: 12.5, monofilament: 3 },
        initialValues: {},
        ...noExistingObs,
      });

      expect(newObs).toEqual([
        { concept: concepts.spirometryUuid, value: 12.5 },
        { concept: concepts.monofilamentUuid, value: 3 },
      ]);
    });

    it('records a zero measurement rather than treating it as an empty field', () => {
      const { newObs } = buildObsForSubmission({
        data: { spirometry: 0 },
        initialValues: {},
        ...noExistingObs,
      });

      expect(newObs).toEqual([{ concept: concepts.spirometryUuid, value: 0 }]);
    });

    it('writes one coded obs per ointment selected', () => {
      const { newObs } = buildObsForSubmission({
        data: { ointments: ['fucidin-uuid', 'silver-uuid'] },
        initialValues: {},
        ...noExistingObs,
      });

      expect(newObs).toEqual([
        { concept: concepts.ointmentUuid, value: 'fucidin-uuid' },
        { concept: concepts.ointmentUuid, value: 'silver-uuid' },
      ]);
    });

    it('writes nothing at all for an untouched form', () => {
      const { newObs, toBeVoided } = buildObsForSubmission({
        data: { ointments: [] },
        initialValues: {},
        ...noExistingObs,
      });

      expect(newObs).toEqual([]);
      expect(toBeVoided).toEqual([]);
    });
  });

  describe('editing an existing record', () => {
    const existingObsByField = new Map<ScalarNursingField, NursingObs>([
      ['typeOfWound', obs('wound-obs', concepts.typeOfWoundUuid, 'Abrasion')],
      ['spirometry', obs('spirometry-obs', concepts.spirometryUuid, 12.5)],
    ]);

    it('leaves untouched fields alone', () => {
      const { newObs, toBeVoided } = buildObsForSubmission({
        data: { typeOfWound: 'Abrasion', spirometry: 12.5, ointments: [] },
        initialValues: { typeOfWound: 'Abrasion', spirometry: 12.5, ointments: [] },
        existingObsByField,
        existingOintmentObs: [],
        concepts,
      });

      expect(newObs).toEqual([]);
      expect(toBeVoided).toEqual([]);
    });

    it('voids the superseded obs and writes the new value for a changed field', () => {
      const { newObs, toBeVoided } = buildObsForSubmission({
        data: { typeOfWound: 'Laceration', spirometry: 12.5, ointments: [] },
        initialValues: { typeOfWound: 'Abrasion', spirometry: 12.5, ointments: [] },
        existingObsByField,
        existingOintmentObs: [],
        concepts,
      });

      expect(toBeVoided).toEqual([{ uuid: 'wound-obs', voided: true }]);
      expect(newObs).toEqual([{ concept: concepts.typeOfWoundUuid, value: 'Laceration' }]);
    });

    it('voids without replacing when a field is cleared', () => {
      const { newObs, toBeVoided } = buildObsForSubmission({
        data: { typeOfWound: '', spirometry: 12.5, ointments: [] },
        initialValues: { typeOfWound: 'Abrasion', spirometry: 12.5, ointments: [] },
        existingObsByField,
        existingOintmentObs: [],
        concepts,
      });

      expect(toBeVoided).toEqual([{ uuid: 'wound-obs', voided: true }]);
      expect(newObs).toEqual([]);
    });

    it('voids every previous ointment obs and rewrites the whole selection when it changes', () => {
      const existingOintmentObs = [
        obs('ointment-obs-1', concepts.ointmentUuid, { uuid: 'fucidin-uuid', display: 'Fucidin' }),
        obs('ointment-obs-2', concepts.ointmentUuid, { uuid: 'silver-uuid', display: 'Silver' }),
      ];

      const { newObs, toBeVoided } = buildObsForSubmission({
        data: { ointments: ['fucidin-uuid', 'calmex-uuid'] },
        initialValues: { ointments: ['fucidin-uuid', 'silver-uuid'] },
        existingObsByField: null,
        existingOintmentObs,
        concepts,
      });

      expect(toBeVoided).toEqual([
        { uuid: 'ointment-obs-1', voided: true },
        { uuid: 'ointment-obs-2', voided: true },
      ]);
      expect(newObs).toEqual([
        { concept: concepts.ointmentUuid, value: 'fucidin-uuid' },
        { concept: concepts.ointmentUuid, value: 'calmex-uuid' },
      ]);
    });

    it('voids the previous ointments when the selection is cleared entirely', () => {
      const existingOintmentObs = [
        obs('ointment-obs-1', concepts.ointmentUuid, { uuid: 'fucidin-uuid', display: 'Fucidin' }),
      ];

      const { newObs, toBeVoided } = buildObsForSubmission({
        data: { ointments: [] },
        initialValues: { ointments: ['fucidin-uuid'] },
        existingObsByField: null,
        existingOintmentObs,
        concepts,
      });

      expect(toBeVoided).toEqual([{ uuid: 'ointment-obs-1', voided: true }]);
      expect(newObs).toEqual([]);
    });

    it('treats a reordered ointment selection as unchanged', () => {
      const existingOintmentObs = [
        obs('ointment-obs-1', concepts.ointmentUuid, { uuid: 'fucidin-uuid', display: 'Fucidin' }),
        obs('ointment-obs-2', concepts.ointmentUuid, { uuid: 'silver-uuid', display: 'Silver' }),
      ];

      const { newObs, toBeVoided } = buildObsForSubmission({
        data: { ointments: ['silver-uuid', 'fucidin-uuid'] },
        initialValues: { ointments: ['fucidin-uuid', 'silver-uuid'] },
        existingObsByField: null,
        existingOintmentObs,
        concepts,
      });

      expect(newObs).toEqual([]);
      expect(toBeVoided).toEqual([]);
    });
  });
});
