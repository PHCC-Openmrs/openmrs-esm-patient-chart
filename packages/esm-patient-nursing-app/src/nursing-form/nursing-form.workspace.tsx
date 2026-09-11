import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  ButtonSet,
  Column,
  FileUploader,
  Form,
  FormLabel,
  InlineNotification,
  Link,
  MultiSelect,
  NumberInput,
  Row,
  Stack,
  TextArea,
  TextInput,
} from '@carbon/react';
import {
  ExtensionSlot,
  type OpenmrsResource,
  ResponsiveWrapper,
  showSnackbar,
  useAbortController,
  useConfig,
  useLayoutType,
  useSession,
  Workspace2,
} from '@openmrs/esm-framework';
import { type PatientWorkspace2DefinitionProps, useOptimisticVisitMutations } from '@openmrs/esm-patient-common-lib';
import { type ConfigObject } from '../config-schema';
import {
  createOrUpdateNursingEncounter,
  getEcgAttachmentSrc,
  uploadEcgAttachment,
  useInvalidateNursingRecords,
  useNursingEncounter,
  useOintmentAnswers,
  withUnit,
} from '../common';
import { type ConceptAnswer, type ScalarNursingField } from '../common/types';
import { buildObsForSubmission } from './nursing-form.utils';
import { NursingFormSchema, type NursingFormData } from './schema';
import styles from './nursing-form.scss';

export interface NursingFormProps {
  formContext: 'creating' | 'editing';
  editEncounterUuid?: string;
}

/**
 * The form for recording the three nursing sections -- Dressing, Other Measures and
 * Nursing Procedures -- into a single nursing encounter.
 */
const NursingForm: React.FC<PatientWorkspace2DefinitionProps<NursingFormProps, object>> = ({
  closeWorkspace,
  workspaceProps,
  groupProps: { patientUuid },
}) => {
  const { editEncounterUuid, formContext = 'creating' } = workspaceProps ?? ({} as NursingFormProps);
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const { concepts, nursing } = useConfig<ConfigObject>();
  const session = useSession();
  const abortController = useAbortController();
  const isEditing = formContext === 'editing';

  const { answers: ointmentAnswers, isLoading: isLoadingOintments } = useOintmentAnswers();
  const {
    existingObsByField,
    existingOintmentObs,
    getInitialValues,
    isLoading: isLoadingEncounter,
    mutate: mutateEncounter,
  } = useNursingEncounter(isEditing ? editEncounterUuid : null);
  const invalidateNursingRecords = useInvalidateNursingRecords(patientUuid);
  const { invalidateVisitRelatedData } = useOptimisticVisitMutations(patientUuid);

  const [showEmptyFormError, setShowEmptyFormError] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { dirtyFields, isSubmitting },
  } = useForm<NursingFormData>({
    mode: 'all',
    resolver: zodResolver(NursingFormSchema),
    defaultValues: { ointments: [] },
  });

  const isLoadingInitialValues = isEditing && isLoadingEncounter;

  const initialValues = useMemo(
    () => (isEditing && !isLoadingEncounter ? getInitialValues() : {}),
    [isEditing, isLoadingEncounter, getInitialValues],
  );

  useEffect(() => {
    if (isEditing && !isLoadingEncounter) {
      reset(initialValues as NursingFormData);
    }
  }, [isEditing, isLoadingEncounter, initialValues, reset]);

  const existingEcgAttachmentUuid = initialValues['ecgImage'] as string | undefined;
  const hasUserUnsavedChanges = Object.keys(dirtyFields).length > 0;

  const onError = useCallback((errors) => {
    if (errors?.oneFieldRequired) {
      setShowEmptyFormError(true);
    }
  }, []);

  const saveNursingRecord = useCallback(
    async (data: NursingFormData) => {
      setShowEmptyFormError(false);
      setSaveError(null);

      const { newObs, toBeVoided } = buildObsForSubmission({
        data,
        initialValues,
        existingObsByField,
        existingOintmentObs,
        concepts,
      });

      const voidExisting = (field: ScalarNursingField) => {
        const obs = existingObsByField?.get(field);
        if (obs) {
          toBeVoided.push({ uuid: obs.uuid, voided: true } as unknown as OpenmrsResource);
        }
      };

      try {
        // The ECG image lives as a patient attachment; the obs records its uuid so the file
        // can be traced back to this encounter. Upload first so a failure aborts the save
        // rather than leaving an obs pointing at a file that was never stored.
        if (data.ecgFile) {
          const attachmentUuid = await uploadEcgAttachment(patientUuid, data.ecgFile, nursing.ecgAttachmentCaption);
          voidExisting('ecgImage');
          newObs.push({ concept: concepts.ecgImageUuid, value: attachmentUuid } as unknown as OpenmrsResource);
        }

        if (!newObs.length && !toBeVoided.length) {
          setShowEmptyFormError(true);
          return;
        }

        await createOrUpdateNursingEncounter(
          patientUuid,
          nursing.encounterTypeUuid,
          isEditing ? editEncounterUuid : null,
          session?.sessionLocation?.uuid,
          [...newObs, ...toBeVoided],
          abortController,
        );

        mutateEncounter?.();
        invalidateNursingRecords();
        invalidateVisitRelatedData({ observations: true, encounters: true });
        closeWorkspace({ discardUnsavedChanges: true });
        showSnackbar({
          isLowContrast: true,
          kind: 'success',
          title: isEditing
            ? t('nursingRecordUpdated', 'Nursing record updated')
            : t('nursingRecordSaved', 'Nursing record saved'),
          subtitle: t('nursingRecordNowAvailable', 'It is now visible on the Nursing page'),
        });
      } catch (error) {
        const subtitle = error instanceof Error ? error.message : undefined;
        setSaveError(subtitle ?? t('unknownError', 'An unknown error occurred'));
        showSnackbar({
          isLowContrast: false,
          kind: 'error',
          title: isEditing
            ? t('nursingRecordUpdateError', 'Error updating nursing record')
            : t('nursingRecordSaveError', 'Error saving nursing record'),
          subtitle,
        });
      }
    },
    [
      abortController,
      closeWorkspace,
      concepts,
      editEncounterUuid,
      existingObsByField,
      existingOintmentObs,
      initialValues,
      invalidateNursingRecords,
      invalidateVisitRelatedData,
      isEditing,
      mutateEncounter,
      nursing.ecgAttachmentCaption,
      nursing.encounterTypeUuid,
      patientUuid,
      session?.sessionLocation?.uuid,
      t,
    ],
  );

  return (
    <Workspace2
      title={isEditing ? t('editNursing', 'Edit nursing record') : t('recordNursing', 'Record nursing')}
      hasUnsavedChanges={hasUserUnsavedChanges}
    >
      <Form className={styles.form} data-openmrs-role="Nursing Form">
        <ExtensionSlot name="visit-context-header-slot" state={{ patientUuid }} />
        <div className={styles.grid}>
          <Stack>
            <Column>
              <p className={styles.title}>{t('dressing', 'Dressing')}</p>
            </Column>
            <Row className={styles.row}>
              <Column className={styles.fullWidth}>
                <ResponsiveWrapper>
                  <Controller
                    name="typeOfWound"
                    control={control}
                    render={({ field: { onChange, onBlur, ref, value } }) => (
                      <TextInput
                        id="typeOfWound"
                        labelText={t('typeOfWound', 'Type of wound')}
                        onBlur={onBlur}
                        onChange={onChange}
                        placeholder={t('typeOfWoundPlaceholder', 'Describe the type of wound')}
                        ref={ref}
                        value={value ?? ''}
                      />
                    )}
                  />
                </ResponsiveWrapper>
              </Column>
            </Row>
            <Row className={styles.row}>
              <Column className={styles.fullWidth}>
                <ResponsiveWrapper>
                  <Controller
                    name="ointments"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <MultiSelect
                        id="ointment"
                        disabled={isLoadingOintments}
                        titleText={t('ointment', 'Ointment')}
                        label={t('selectOintments', 'Select ointments')}
                        items={ointmentAnswers}
                        itemToString={(answer: ConceptAnswer) => answer?.display ?? ''}
                        selectedItems={ointmentAnswers.filter((answer) =>
                          ((value as Array<string>) ?? []).includes(answer.uuid),
                        )}
                        onChange={({ selectedItems }) =>
                          onChange((selectedItems ?? []).map((answer: ConceptAnswer) => answer.uuid))
                        }
                      />
                    )}
                  />
                </ResponsiveWrapper>
              </Column>
            </Row>
            <Row className={styles.row}>
              <Column className={styles.fullWidth}>
                <ResponsiveWrapper>
                  <Controller
                    name="dressingGeneralNotes"
                    control={control}
                    render={({ field: { onChange, onBlur, ref, value } }) => (
                      <TextArea
                        id="dressingGeneralNotes"
                        labelText={t('generalNotes', 'General notes')}
                        onBlur={onBlur}
                        onChange={onChange}
                        placeholder={t(
                          'generalNotesPlaceholder',
                          'Type any additional observations about the dressing case here',
                        )}
                        ref={ref}
                        rows={3}
                        value={value ?? ''}
                      />
                    )}
                  />
                </ResponsiveWrapper>
              </Column>
            </Row>
          </Stack>

          <Stack className={styles.spacer}>
            <Column>
              <p className={styles.title}>{t('otherMeasures', 'Other Measures')}</p>
            </Column>
            <Row className={styles.row}>
              <Column className={styles.fullWidth}>
                <FormLabel className={styles.fileLabel}>{t('ecgResult', 'ECG result')}</FormLabel>
                {existingEcgAttachmentUuid ? (
                  <p className={styles.existingAttachment}>
                    <Link
                      href={getEcgAttachmentSrc(existingEcgAttachmentUuid)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('viewCurrentEcg', 'View the ECG currently on this record')}
                    </Link>
                    <span className={styles.helperText}>
                      {t('uploadReplacesEcg', 'Uploading a new file replaces it.')}
                    </span>
                  </p>
                ) : null}
                <Controller
                  name="ecgFile"
                  control={control}
                  render={({ field: { onChange } }) => (
                    <FileUploader
                      accept={['image/*', '.pdf']}
                      buttonKind="tertiary"
                      buttonLabel={t('addFile', 'Add file')}
                      filenameStatus="edit"
                      iconDescription={t('removeFile', 'Remove file')}
                      labelDescription={t(
                        'ecgUploadDescription',
                        'Upload an image or PDF of the ECG result. Max file size is determined by the server.',
                      )}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                        onChange(event.target.files?.[0] ?? null)
                      }
                      onDelete={() => onChange(null)}
                    />
                  )}
                />
              </Column>
            </Row>
            <Row className={styles.row}>
              <Column>
                <ResponsiveWrapper>
                  <Controller
                    name="spirometry"
                    control={control}
                    render={({ field: { onChange, onBlur, ref, value } }) => (
                      <NumberInput
                        allowEmpty
                        disableWheel
                        hideSteppers
                        id="spirometry"
                        label={withUnit(t('spirometry', 'Spirometry'), nursing.spirometryUnit)}
                        onBlur={onBlur}
                        onChange={(_event, { value: nextValue }) =>
                          onChange(nextValue === '' || nextValue == null ? undefined : Number(nextValue))
                        }
                        ref={ref}
                        value={value ?? ''}
                      />
                    )}
                  />
                </ResponsiveWrapper>
              </Column>
              <Column>
                <ResponsiveWrapper>
                  <Controller
                    name="monofilament"
                    control={control}
                    render={({ field: { onChange, onBlur, ref, value } }) => (
                      <NumberInput
                        allowEmpty
                        disableWheel
                        hideSteppers
                        id="monofilament"
                        label={withUnit(t('monofilament', 'Monofilament'), nursing.monofilamentUnit)}
                        onBlur={onBlur}
                        onChange={(_event, { value: nextValue }) =>
                          onChange(nextValue === '' || nextValue == null ? undefined : Number(nextValue))
                        }
                        ref={ref}
                        value={value ?? ''}
                      />
                    )}
                  />
                </ResponsiveWrapper>
              </Column>
            </Row>
          </Stack>

          <Stack className={styles.spacer}>
            <Column>
              <p className={styles.title}>{t('nursingProcedures', 'Nursing Procedures')}</p>
            </Column>
            <Row className={styles.row}>
              {(
                [
                  { id: 'imInjection', label: t('imInjection', 'IM injection') },
                  { id: 'ivInjection', label: t('ivInjection', 'IV injection') },
                  { id: 'oral', label: t('oral', 'Oral') },
                  { id: 'nebulization', label: t('nebulization', 'Nebulization') },
                ] as const
              ).map(({ id, label }) => (
                <Column className={styles.fullWidth} key={id}>
                  <ResponsiveWrapper>
                    <Controller
                      name={id}
                      control={control}
                      render={({ field: { onChange, onBlur, ref, value } }) => (
                        <TextInput
                          id={id}
                          labelText={label}
                          onBlur={onBlur}
                          onChange={onChange}
                          ref={ref}
                          value={value ?? ''}
                        />
                      )}
                    />
                  </ResponsiveWrapper>
                </Column>
              ))}
            </Row>
          </Stack>
        </div>

        {showEmptyFormError && (
          <Column className={styles.errorContainer}>
            <InlineNotification
              lowContrast
              title={t('error', 'Error')}
              subtitle={t('pleaseFillField', 'Please fill at least one field') + '.'}
              onClose={() => setShowEmptyFormError(false)}
            />
          </Column>
        )}

        {saveError && (
          <Column className={styles.errorContainer}>
            <InlineNotification
              className={styles.errorNotification}
              lowContrast={false}
              onClose={() => setSaveError(null)}
              title={t('nursingRecordSaveError', 'Error saving nursing record')}
              subtitle={saveError}
            />
          </Column>
        )}

        <ButtonSet className={isTablet ? styles.tablet : styles.desktop}>
          <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()}>
            {t('discard', 'Discard')}
          </Button>
          <Button
            className={styles.button}
            kind="primary"
            onClick={handleSubmit(saveNursingRecord, onError)}
            disabled={!hasUserUnsavedChanges || isSubmitting || isLoadingInitialValues}
            type="submit"
          >
            {t('saveAndClose', 'Save and close')}
          </Button>
        </ButtonSet>
      </Form>
    </Workspace2>
  );
};

export default NursingForm;
