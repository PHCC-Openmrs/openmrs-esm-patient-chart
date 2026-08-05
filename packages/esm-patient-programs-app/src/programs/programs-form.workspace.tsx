import React, { useCallback, useMemo } from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import dayjs from 'dayjs';
import {
  Button,
  ButtonSet,
  Form,
  FormGroup,
  FormLabel,
  InlineLoading,
  InlineNotification,
  Layer,
  MultiSelect,
  Select,
  SelectItem,
  Stack,
} from '@carbon/react';
import { z } from 'zod';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  getCoreTranslation,
  LocationPicker,
  OpenmrsDatePicker,
  parseDate,
  showSnackbar,
  useConfig,
  useLayoutType,
  useSession,
  Workspace2,
} from '@openmrs/esm-framework';
import { type PatientWorkspace2DefinitionProps } from '@openmrs/esm-patient-common-lib';
import { type ConfigObject } from '../config-schema';
import {
  createProgramEnrollment,
  filterProgramsByLocation,
  findLastState,
  updateProgramEnrollment,
  useAvailablePrograms,
  useEnrollments,
} from './programs.resource';
import styles from './programs-form.scss';

export interface ProgramsFormProps {
  programEnrollmentId?: string;
}

const createProgramsFormSchema = (t: TFunction) =>
  z
    .object({
      selectedPrograms: z
        .array(z.string())
        .min(1, t('serviceRequired', 'At least one service is required')),
      enrollmentDate: z.date(),
      completionDate: z.date().optional().nullable(),
      enrollmentLocation: z.string(),
      selectedProgramStatus: z.string(),
    })
    .superRefine((data, ctx) => {
      if (
        data.completionDate &&
        data.enrollmentDate &&
        dayjs(data.completionDate).isBefore(data.enrollmentDate, 'day')
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t(
            'completionDateCannotBeBeforeEnrollmentDate',
            'Completion date cannot be before the enrollment date',
          ),
          path: ['completionDate'],
        });
      }
    });

export type ProgramsFormData = z.infer<ReturnType<typeof createProgramsFormSchema>>;

const ProgramsForm: React.FC<PatientWorkspace2DefinitionProps<ProgramsFormProps, {}>> = ({
  closeWorkspace,
  groupProps: { patientUuid },
  workspaceProps: { programEnrollmentId },
}) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const session = useSession();
  const { data: availablePrograms } = useAvailablePrograms();
  const { data: enrollments, mutateEnrollments } = useEnrollments(patientUuid);
  const { showProgramStatusField, programsLocationRestrictions } = useConfig<ConfigObject>();
  const inEditMode = Boolean(programEnrollmentId);

  const programsFormSchema = useMemo(() => createProgramsFormSchema(t), [t]);

  const currentEnrollment = programEnrollmentId && enrollments.filter((e) => e.uuid === programEnrollmentId)[0];
  const currentProgram = currentEnrollment
    ? {
        display: currentEnrollment.program.name,
        ...currentEnrollment.program,
      }
    : null;

  const eligibleProgramsBeforeLocationFilter = currentProgram
    ? [currentProgram]
    : availablePrograms.filter((program) => {
        const enrollment = enrollments.find((e) => e.program.uuid === program.uuid);
        return !enrollment || enrollment.dateCompleted !== null;
      });

  const eligiblePrograms = currentProgram
    ? eligibleProgramsBeforeLocationFilter
    : filterProgramsByLocation(
        eligibleProgramsBeforeLocationFilter,
        programsLocationRestrictions,
        session?.sessionLocation?.uuid,
      );

  const getLocationUuid = () => {
    if (!currentEnrollment?.location?.uuid && session?.sessionLocation?.uuid) {
      return session?.sessionLocation?.uuid;
    }
    return currentEnrollment?.location?.uuid ?? null;
  };

  const currentState = currentEnrollment ? findLastState(currentEnrollment.states) : null;

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProgramsFormData>({
    mode: 'all',
    resolver: zodResolver(programsFormSchema),
    defaultValues: {
      selectedPrograms: currentEnrollment?.program.uuid ? [currentEnrollment.program.uuid] : [],
      enrollmentDate: currentEnrollment?.dateEnrolled ? parseDate(currentEnrollment.dateEnrolled) : new Date(),
      completionDate: currentEnrollment?.dateCompleted ? parseDate(currentEnrollment.dateCompleted) : null,
      enrollmentLocation: getLocationUuid() ?? '',
      selectedProgramStatus: currentState?.state.uuid ?? '',
    },
  });

  const selectedPrograms = useWatch({ control, name: 'selectedPrograms' }) ?? [];

  const onSubmit = useCallback(
    async (data: ProgramsFormData) => {
      const { selectedPrograms, enrollmentDate, completionDate, enrollmentLocation, selectedProgramStatus } = data;

      const dateEnrolled = enrollmentDate ? dayjs(enrollmentDate).format() : null;
      // The date picker emits midnight timestamps, which the backend would reject as "before" a
      // same-day enrollment. Align those to the enrollment timestamp, but preserve stored
      // completion times that already fall later on the same day.
      const dateCompleted = completionDate
        ? dayjs(completionDate).isSame(enrollmentDate, 'day') && dayjs(completionDate).isBefore(enrollmentDate)
          ? dayjs(enrollmentDate).format()
          : dayjs(completionDate).format()
        : null;

      try {
        const abortController = new AbortController();

        if (currentEnrollment) {
          await updateProgramEnrollment(
            currentEnrollment.uuid,
            {
              dateEnrolled,
              dateCompleted,
              location: enrollmentLocation,
              states:
                !!selectedProgramStatus && selectedProgramStatus != currentState?.state.uuid
                  ? [{ state: { uuid: selectedProgramStatus } }]
                  : [],
            },
            abortController,
          );
        } else {
          await Promise.all(
            selectedPrograms.map((programUuid) =>
              createProgramEnrollment(
                {
                  patient: patientUuid,
                  program: programUuid,
                  dateEnrolled,
                  dateCompleted,
                  location: enrollmentLocation,
                  states: [],
                },
                abortController,
              ),
            ),
          );
        }

        await mutateEnrollments();
        closeWorkspace({ discardUnsavedChanges: true });

        showSnackbar({
          kind: 'success',
          title: currentEnrollment
            ? t('enrollmentUpdated', 'Service enrollment updated')
            : t('enrollmentSaved', 'Service enrollment saved'),
          subtitle: currentEnrollment
            ? t('enrollmentUpdatesNowVisible', 'Changes to the service are now visible in the Services table')
            : t('enrollmentNowVisible', 'It is now visible in the Services table'),
        });
      } catch (error) {
        showSnackbar({
          kind: 'error',
          title: t('programEnrollmentSaveError', 'Error saving service enrollment'),
          subtitle: error instanceof Error ? error.message : 'An unknown error occurred',
        });
      }
    },
    [closeWorkspace, currentEnrollment, currentState, mutateEnrollments, patientUuid, t],
  );

  const programName = (
    <FormGroup legendText={t('serviceName', 'Service name')}>
      <FormLabel className={styles.programName}>{currentProgram?.display}</FormLabel>
    </FormGroup>
  );

  const programSelect = (
    <Controller
      name="selectedPrograms"
      control={control}
      render={({ field: { onChange, value } }) => (
        <MultiSelect
          id="program"
          titleText={t('serviceName', 'Service name')}
          label={t('chooseServices', 'Choose services')}
          invalid={!!errors?.selectedPrograms}
          invalidText={errors?.selectedPrograms?.message}
          items={eligiblePrograms ?? []}
          itemToString={(program) => program?.display ?? ''}
          selectedItems={eligiblePrograms?.filter((program) => value?.includes(program.uuid)) ?? []}
          onChange={({ selectedItems }) => onChange(selectedItems.map((program) => program.uuid))}
        />
      )}
    />
  );

  const enrollmentDate = (
    <Controller
      name="enrollmentDate"
      control={control}
      render={({ field, fieldState }) => (
        <OpenmrsDatePicker
          {...field}
          id="enrollmentDate"
          data-testid="enrollmentDate"
          maxDate={(() => {
            const completionDate = watch('completionDate');
            return completionDate ? dayjs(completionDate).toDate() : new Date();
          })()}
          labelText={t('dateEnrolled', 'Date enrolled')}
          invalid={Boolean(fieldState?.error?.message)}
          invalidText={fieldState?.error?.message}
        />
      )}
    />
  );

  // Commented out per request: completion date isn't collected at enrollment time anymore.
  // const completionDate = (
  //   <Controller
  //     name="completionDate"
  //     control={control}
  //     render={({ field, fieldState }) => (
  //       <OpenmrsDatePicker
  //         {...field}
  //         id="completionDate"
  //         data-testid="completionDate"
  //         minDate={dayjs(watch('enrollmentDate')).toDate()}
  //         maxDate={new Date()}
  //         labelText={t('dateCompleted', 'Date completed')}
  //         invalid={Boolean(fieldState?.error?.message)}
  //         invalidText={fieldState?.error?.message}
  //       />
  //     )}
  //   />
  // );

  // Commented out per request: location always defaults to and stays as the session location,
  // no picker shown.
  // const enrollmentLocation = (
  //   <Controller
  //     name="enrollmentLocation"
  //     control={control}
  //     render={({ field: { onChange, value } }) => (
  //       <React.Fragment>
  //         <FormLabel className={`${styles.locationLabel} cds--label`}>
  //           {t('enrollmentLocation', 'Enrollment location')}
  //         </FormLabel>
  //         <LocationPicker
  //           selectedLocationUuid={value}
  //           defaultLocationUuid={session?.sessionLocation?.uuid}
  //           locationTag="Login Location"
  //           onChange={(locationUuid) => onChange(locationUuid)}
  //         />
  //       </React.Fragment>
  //     )}
  //   />
  // );

  // A single status field can't represent multiple different services' workflows, so it
  // only applies in edit mode (a single existing enrollment) or when exactly one service is
  // selected for a new enrollment.
  let workflowStates = [];
  if (!currentProgram && selectedPrograms.length === 1) {
    const program = eligiblePrograms.find((p) => p.uuid === selectedPrograms[0]);
    if (program?.allWorkflows.length > 0) workflowStates = program.allWorkflows[0].states;
  } else if (currentProgram?.allWorkflows.length > 0) {
    workflowStates = currentProgram.allWorkflows[0].states;
  }

  const canShowProgramStatus = inEditMode || selectedPrograms.length === 1;

  const programStatusDropdown = (
    <Controller
      name="selectedProgramStatus"
      control={control}
      render={({ field: { onChange, value } }) => (
        <Select
          aria-label={t('serviceStatus', 'Service status')}
          id="programStatus"
          invalid={!!errors?.selectedProgramStatus}
          invalidText={errors?.selectedProgramStatus?.message}
          labelText={t('serviceStatus', 'Service status')}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        >
          <SelectItem text={t('chooseStatus', 'Choose a service status')} value="" />
          {workflowStates.map((state) => (
            <SelectItem key={state.uuid} text={state.concept.display} value={state.uuid}>
              {state.concept.display}
            </SelectItem>
          ))}
        </Select>
      )}
    />
  );

  const formGroups = [
    inEditMode
      ? {
          style: { maxWidth: isTablet && '50%' },
          legendText: '',
          value: programName,
        }
      : {
          style: { maxWidth: isTablet && '50%' },
          legendText: '',
          value: programSelect,
        },
    {
      style: { maxWidth: '50%' },
      legendText: '',
      value: enrollmentDate,
    },
    // Commented out per request: end date and location fields are no longer shown on the
    // enrollment form (location always uses the session location; see the commented-out
    // `completionDate`/`enrollmentLocation` definitions above).
    // {
    //   style: { width: '50%' },
    //   legendText: '',
    //   value: completionDate,
    // },
    // {
    //   style: { width: '100%' },
    //   legendText: '',
    //   value: enrollmentLocation,
    // },
  ];

  if (showProgramStatusField && canShowProgramStatus) {
    formGroups.push({
      style: { maxWidth: '50%' },
      legendText: '',
      value: programStatusDropdown,
    });
  }

  return (
    <Workspace2 title={t('programEnrollmentWorkspaceTitle', 'Service enrollment')} hasUnsavedChanges={isDirty}>
      <Form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        <Stack className={styles.formContainer} gap={7}>
          {!availablePrograms.length && (
            <InlineNotification
              className={styles.notification}
              kind="error"
              lowContrast
              subtitle={t('configurePrograms', 'Please configure services to continue.')}
              title={t('noProgramsConfigured', 'No services configured')}
            />
          )}
          {formGroups.map((group, i) => (
            <FormGroup style={group.style} legendText={group.legendText} key={i}>
              <div className={styles.selectContainer}>{isTablet ? <Layer>{group.value}</Layer> : group.value}</div>
            </FormGroup>
          ))}
        </Stack>
        <ButtonSet className={classNames(isTablet ? styles.tablet : styles.desktop)}>
          <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()}>
            {getCoreTranslation('cancel')}
          </Button>
          <Button className={styles.button} disabled={isSubmitting} kind="primary" type="submit">
            {isSubmitting ? (
              <InlineLoading description={t('saving', 'Saving') + '...'} />
            ) : (
              <span>{t('saveAndClose', 'Save and close')}</span>
            )}
          </Button>
        </ButtonSet>
      </Form>
    </Workspace2>
  );
};

export default ProgramsForm;
