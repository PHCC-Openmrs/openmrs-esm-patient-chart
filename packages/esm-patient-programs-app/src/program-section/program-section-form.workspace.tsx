import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ButtonSet, Form, FormLabel, NumberInput, Select, SelectItem, Stack, TextInput } from '@carbon/react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import dayjs from 'dayjs';
import {
  formatDate,
  getCoreTranslation,
  OpenmrsDatePicker,
  parseDate,
  showSnackbar,
  useSession,
  Workspace2,
} from '@openmrs/esm-framework';
import { type PatientWorkspace2DefinitionProps } from '@openmrs/esm-patient-common-lib';
import { type ProgramSectionConfig, type ProgramSectionField } from '../config-schema';
import {
  computeAutofillValue,
  findObsFormValue,
  saveProgramSectionEncounter,
  updateProgramSectionEncounter,
  useLatestObsValues,
  useProgramSectionEncounters,
  usePatientAge,
  type ProgramSectionEncounter,
} from './program-section.resource';
import styles from './program-section-form.scss';

export interface ProgramSectionFormProps {
  section: ProgramSectionConfig;
  encounterToEdit?: ProgramSectionEncounter;
}

const ProgramSectionForm: React.FC<PatientWorkspace2DefinitionProps<ProgramSectionFormProps, {}>> = ({
  closeWorkspace,
  groupProps: { patientUuid },
  workspaceProps: { section, encounterToEdit },
}) => {
  const { t } = useTranslation();
  const session = useSession();
  const isEditing = !!encounterToEdit;
  const { age, isLoading: isLoadingAge } = usePatientAge(patientUuid);
  const { mutateEncounters } = useProgramSectionEncounters(patientUuid, section.encounterTypeUuid);

  // Source concepts for fields computed from data recorded elsewhere in the patient's record
  // rather than from a sibling field -- e.g. EDD and gestational age, both derived from the LMP
  // captured in the SRH Assessment section.
  const latestObsConceptUuids = useMemo(
    () => section.fields.map((field) => field.autofillFromLatestObsConceptUuid).filter(Boolean),
    [section.fields],
  );
  const { latestObsValues, isLoading: isLoadingLatestObs } = useLatestObsValues(patientUuid, latestObsConceptUuids);

  // Date-relative autofills are computed as of the encounter being recorded, so editing an old
  // encounter recomputes them against that encounter's date rather than today.
  const referenceDate = useMemo(
    () => (encounterToEdit ? new Date(encounterToEdit.encounterDatetime) : new Date()),
    [encounterToEdit],
  );

  // Some fields (e.g. Diagnosis) have two config entries sharing the same concept, one per
  // age band (e.g. <=5 read-only/autofilled, >5 manually chosen) -- only one is ever visible
  // for a given patient, so keying by conceptUuid below never collides at runtime.
  const ageEligibleFields = useMemo(
    () => section.fields.filter((field) => age != null && age >= field.minAge && age <= field.maxAge),
    [section.fields, age],
  );

  const { control, handleSubmit, setValue, formState } = useForm<Record<string, string>>({
    defaultValues: Object.fromEntries(
      section.fields.map((field) => [field.conceptUuid, findObsFormValue(encounterToEdit, field.conceptUuid)]),
    ),
  });

  const [missingConceptUuids, setMissingConceptUuids] = useState<Set<string>>(new Set());

  const formValues = useWatch({ control });

  const isFieldVisible = useCallback(
    (field: ProgramSectionField) =>
      !field.visibleWhenConceptUuid || formValues[field.visibleWhenConceptUuid] === field.visibleWhenValue,
    [formValues],
  );

  // e.g. "Type of supplement received" only shows once "Received supplement" is answered "Yes".
  const visibleFields = useMemo(() => ageEligibleFields.filter(isFieldVisible), [ageEligibleFields, isFieldVisible]);

  useEffect(() => {
    ageEligibleFields.forEach((field) => {
      if (!isFieldVisible(field)) {
        // Clear values behind a hidden dependent field, so toggling e.g. "Received supplement"
        // back to "No" doesn't silently resubmit a stale answer for the fields it hides.
        if ((formValues[field.conceptUuid] ?? '') !== '') {
          setValue(field.conceptUuid, '');
        }
        return;
      }
      if (!field.autofillRule || (!field.autofillFromConceptUuid && !field.autofillFromLatestObsConceptUuid)) {
        return;
      }
      const sourceValue = field.autofillFromLatestObsConceptUuid
        ? latestObsValues[field.autofillFromLatestObsConceptUuid] ?? ''
        : formValues[field.autofillFromConceptUuid] ?? '';
      const computedValue = computeAutofillValue(field.autofillRule, sourceValue, referenceDate);
      if (computedValue !== (formValues[field.conceptUuid] ?? '')) {
        setValue(field.conceptUuid, computedValue);
      }
    });
    // Only re-run when the watched form values or the looked-up source obs change --
    // ageEligibleFields/isFieldVisible/setValue/referenceDate are stable for the lifetime of this
    // workspace instance (derived from the fixed `section`/`encounterToEdit` props).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formValues, latestObsValues]);

  // Clear the "missing" flag on a field as soon as it's filled in, rather than only on the next
  // failed submit attempt.
  useEffect(() => {
    setMissingConceptUuids((previous) => {
      const stillMissing = [...previous].filter((conceptUuid) => !formValues[conceptUuid]);
      return stillMissing.length === previous.size ? previous : new Set(stillMissing);
    });
  }, [formValues]);

  const onSubmit = useCallback(
    async (values: Record<string, string>) => {
      // Every currently-visible field is mandatory unless it's explicitly marked `optional`
      // (free-text notes, measurements that only apply to part of a pregnancy, values computed
      // from data the patient may not have on record yet). Fields hidden by age or a
      // visibleWhenConceptUuid condition (e.g. the supplement fields when "Received
      // supplement" is "No") are correctly excluded, since they don't apply to this patient.
      const missingFields = visibleFields.filter((field) => !field.optional && !values[field.conceptUuid]);
      if (missingFields.length > 0) {
        setMissingConceptUuids(new Set(missingFields.map((field) => field.conceptUuid)));
        showSnackbar({
          kind: 'error',
          title: t('missingRequiredFields', 'Please fill in all fields'),
          subtitle: missingFields.map((field) => field.label).join(', '),
        });
        return;
      }
      setMissingConceptUuids(new Set());

      const abortController = new AbortController();
      try {
        // UI-only fields (persist: false) have no real concept behind them -- they only exist
        // to drive visibleWhenConceptUuid, so their answer is never sent as an observation.
        const persistedConceptUuids = new Set(
          section.fields.filter((field) => field.persist !== false).map((field) => field.conceptUuid),
        );
        const persistedValues = Object.fromEntries(
          Object.entries(values).filter(([conceptUuid]) => persistedConceptUuids.has(conceptUuid)),
        );
        if (isEditing) {
          await updateProgramSectionEncounter(
            encounterToEdit.uuid,
            encounterToEdit.obs,
            persistedValues,
            abortController,
          );
        } else {
          await saveProgramSectionEncounter(
            patientUuid,
            session?.sessionLocation?.uuid,
            section.encounterTypeUuid,
            persistedValues,
            abortController,
          );
        }
        await mutateEncounters();
        closeWorkspace({ discardUnsavedChanges: true });
        showSnackbar({
          kind: 'success',
          title: t('sectionSaved', '{{sectionTitle}} saved', { sectionTitle: section.sectionTitle }),
        });
      } catch (error) {
        showSnackbar({
          kind: 'error',
          title: t('sectionSaveError', 'Error saving {{sectionTitle}}', { sectionTitle: section.sectionTitle }),
          subtitle: error instanceof Error ? error.message : 'An unknown error occurred',
        });
      }
    },
    [closeWorkspace, encounterToEdit, isEditing, mutateEncounters, patientUuid, section, session, t, visibleFields],
  );

  const workspaceTitle = isEditing
    ? t('editSectionTitle', 'Edit {{sectionTitle}}', { sectionTitle: section.sectionTitle })
    : section.sectionTitle;

  if (isLoadingAge || isLoadingLatestObs) {
    return (
      <Workspace2 title={workspaceTitle} hasUnsavedChanges={false}>
        <div className={styles.formContainer} />
      </Workspace2>
    );
  }

  return (
    <Workspace2 title={workspaceTitle} hasUnsavedChanges>
      <Form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        <Stack className={styles.formContainer} gap={1}>
          {visibleFields.map((field) => (
            <div key={field.conceptUuid}>
              <Controller
                name={field.conceptUuid}
                control={control}
                render={({ field: { onChange, value } }) => {
                  if (field.readOnly) {
                    // An autofilled date holds a raw timestamp -- show it the way the date picker
                    // and the summary table would, not as an ISO string.
                    const displayValue =
                      field.controlType === 'date' && value ? formatDate(parseDate(value), { time: false }) : value;
                    return (
                      <div className={styles.readOnlyField}>
                        <FormLabel>{field.label}</FormLabel>
                        <p className={styles.readOnlyValue}>{displayValue || '--'}</p>
                      </div>
                    );
                  }

                  if (field.controlType === 'date') {
                    return (
                      <OpenmrsDatePicker
                        id={`field-${field.conceptUuid}`}
                        labelText={field.label}
                        value={value ? parseDate(value) : null}
                        maxDate={new Date()}
                        onChange={(date) => onChange(date ? dayjs(date).format() : '')}
                      />
                    );
                  }

                  if (field.controlType === 'select') {
                    const choices = field.answers?.length
                      ? field.answers.map((answer) => ({ text: answer.label, value: answer.conceptUuid }))
                      : field.options.map((option) => ({ text: option, value: option }));

                    return (
                      <Select
                        id={`field-${field.conceptUuid}`}
                        labelText={field.label}
                        value={value ?? ''}
                        invalid={missingConceptUuids.has(field.conceptUuid)}
                        invalidText={t('fieldRequired', 'This field is required')}
                        onChange={(event) => onChange(event.target.value)}
                      >
                        <SelectItem text={t('chooseAnOption', 'Choose an option')} value="" />
                        {choices.map((choice) => (
                          <SelectItem key={choice.value} text={choice.text} value={choice.value} />
                        ))}
                      </Select>
                    );
                  }

                  if (field.controlType === 'number') {
                    return (
                      <NumberInput
                        id={`field-${field.conceptUuid}`}
                        label={field.label}
                        value={value ?? ''}
                        allowEmpty
                        min={0}
                        invalid={missingConceptUuids.has(field.conceptUuid)}
                        invalidText={t('fieldRequired', 'This field is required')}
                        onChange={(_event, state) => {
                          // Carbon's NumberInput can emit NaN (e.g. clicking the +/- stepper
                          // while empty) -- without this check that becomes the literal
                          // string "NaN", which the backend rejects for a Numeric concept.
                          // Every number field in this form (MUAC, supplement quantity, gravidity)
                          // is a non-negative count/measurement, so also clamp out any negative
                          // value the stepper or manual typing could otherwise produce.
                          const numericValue = state?.value != null ? Number(state.value) : NaN;
                          onChange(!Number.isNaN(numericValue) ? String(Math.max(0, numericValue)) : '');
                        }}
                      />
                    );
                  }

                  return (
                    <TextInput
                      id={`field-${field.conceptUuid}`}
                      labelText={field.label}
                      value={value ?? ''}
                      invalid={missingConceptUuids.has(field.conceptUuid)}
                      invalidText={t('fieldRequired', 'This field is required')}
                      onChange={(event) => onChange(event.target.value)}
                    />
                  );
                }}
              />
            </div>
          ))}
        </Stack>
        <ButtonSet className={styles.buttonSet}>
          <Button kind="secondary" onClick={() => closeWorkspace()}>
            {getCoreTranslation('cancel')}
          </Button>
          <Button kind="primary" type="submit" disabled={formState.isSubmitting}>
            {t('saveAndClose', 'Save and close')}
          </Button>
        </ButtonSet>
      </Form>
    </Workspace2>
  );
};

export default ProgramSectionForm;
