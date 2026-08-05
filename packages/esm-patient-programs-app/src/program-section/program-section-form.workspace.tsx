import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ButtonSet, Form, FormLabel, NumberInput, Select, SelectItem, Stack, TextInput } from '@carbon/react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import dayjs from 'dayjs';
import {
  getCoreTranslation,
  OpenmrsDatePicker,
  parseDate,
  showSnackbar,
  useSession,
  Workspace2,
} from '@openmrs/esm-framework';
import { type PatientWorkspace2DefinitionProps } from '@openmrs/esm-patient-common-lib';
import { type ProgramSectionConfig } from '../config-schema';
import {
  computeAutofillValue,
  saveProgramSectionEncounter,
  useProgramSectionEncounters,
  usePatientAge,
} from './program-section.resource';
import styles from './program-section-form.scss';

export interface ProgramSectionFormProps {
  section: ProgramSectionConfig;
}

const ProgramSectionForm: React.FC<PatientWorkspace2DefinitionProps<ProgramSectionFormProps, {}>> = ({
  closeWorkspace,
  groupProps: { patientUuid },
  workspaceProps: { section },
}) => {
  const { t } = useTranslation();
  const session = useSession();
  const { age, isLoading: isLoadingAge } = usePatientAge(patientUuid);
  const { mutateEncounters } = useProgramSectionEncounters(patientUuid, section.encounterTypeUuid);

  // Some fields (e.g. Diagnosis) have two config entries sharing the same concept, one per
  // age band (e.g. <=5 read-only/autofilled, >5 manually chosen) -- only one is ever visible
  // for a given patient, so keying by conceptUuid below never collides at runtime.
  const visibleFields = useMemo(
    () => section.fields.filter((field) => age != null && age >= field.minAge && age <= field.maxAge),
    [section.fields, age],
  );

  const { control, handleSubmit, setValue, formState } = useForm<Record<string, string>>({
    defaultValues: Object.fromEntries(section.fields.map((field) => [field.conceptUuid, ''])),
  });

  const formValues = useWatch({ control });

  useEffect(() => {
    visibleFields.forEach((field) => {
      if (!field.autofillFromConceptUuid || !field.autofillRule) {
        return;
      }
      const sourceValue = formValues[field.autofillFromConceptUuid] ?? '';
      const computedValue = computeAutofillValue(field.autofillRule, sourceValue);
      if (computedValue !== (formValues[field.conceptUuid] ?? '')) {
        setValue(field.conceptUuid, computedValue);
      }
    });
    // Only re-run when the watched form values change -- visibleFields/setValue are stable
    // for the lifetime of this workspace instance (derived from the fixed `section` prop).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formValues]);

  const onSubmit = useCallback(
    async (values: Record<string, string>) => {
      const abortController = new AbortController();
      try {
        await saveProgramSectionEncounter(
          patientUuid,
          session?.sessionLocation?.uuid,
          section.encounterTypeUuid,
          values,
          abortController,
        );
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
    [closeWorkspace, mutateEncounters, patientUuid, section, session, t],
  );

  if (isLoadingAge) {
    return (
      <Workspace2 title={section.sectionTitle} hasUnsavedChanges={false}>
        <div className={styles.formContainer} />
      </Workspace2>
    );
  }

  return (
    <Workspace2 title={section.sectionTitle} hasUnsavedChanges>
      <Form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        <Stack className={styles.formContainer} gap={1}>
          {visibleFields.map((field) => (
            <div key={field.conceptUuid}>
              <Controller
                name={field.conceptUuid}
                control={control}
                render={({ field: { onChange, value } }) => {
                  if (field.readOnly) {
                    return (
                      <div className={styles.readOnlyField}>
                        <FormLabel>{field.label}</FormLabel>
                        <p className={styles.readOnlyValue}>{value || '--'}</p>
                      </div>
                    );
                  }

                  if (field.controlType === 'date') {
                    return (
                      <OpenmrsDatePicker
                        id={`field-${field.conceptUuid}`}
                        labelText={field.label}
                        value={value ? parseDate(value) : null}
                        onChange={(date) => onChange(date ? dayjs(date).format() : '')}
                      />
                    );
                  }

                  if (field.controlType === 'select') {
                    return (
                      <Select
                        id={`field-${field.conceptUuid}`}
                        labelText={field.label}
                        value={value ?? ''}
                        onChange={(event) => onChange(event.target.value)}
                      >
                        <SelectItem text={t('chooseAnOption', 'Choose an option')} value="" />
                        {field.options.map((option) => (
                          <SelectItem key={option} text={option} value={option} />
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
                        onChange={(_event, state) => {
                          // Carbon's NumberInput can emit NaN (e.g. clicking the +/- stepper
                          // while empty) -- without this check that becomes the literal
                          // string "NaN", which the backend rejects for a Numeric concept.
                          const numericValue = state?.value;
                          onChange(numericValue != null && !Number.isNaN(numericValue) ? String(numericValue) : '');
                        }}
                      />
                    );
                  }

                  return (
                    <TextInput
                      id={`field-${field.conceptUuid}`}
                      labelText={field.label}
                      value={value ?? ''}
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
