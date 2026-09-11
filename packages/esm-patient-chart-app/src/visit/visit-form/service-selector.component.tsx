import React, { useEffect } from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { MultiSelect } from '@carbon/react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { useServicePrograms, type ServiceProgram } from '../hooks/useServicePrograms';
import { type VisitFormData } from './visit-form.resource';
import styles from './visit-form.scss';

/**
 * Lets the user pick which service(s) (programs) a visit is for, so the visit is attributable to
 * those services in reports and so the visit form can enroll/complete a matching program episode
 * per selected service (see the onSubmit handling of `serviceProgram` in
 * exported-visit-form.workspace.tsx). Multiple services can apply to a single visit (e.g. a
 * patient seen for both Nutrition Registration and Pediatric Consultation on the same visit).
 *
 * Options are filtered by the visit location currently selected in the form (not the session
 * location), reusing the same location restrictions esm-patient-programs-app's "Add service"
 * form applies -- see useServicePrograms.
 */
const ServiceSelector: React.FC = () => {
  const { t } = useTranslation();
  const { control, setValue, getValues } = useFormContext<VisitFormData>();
  const visitLocation = useWatch<VisitFormData, 'visitLocation'>({ control, name: 'visitLocation' });
  const { servicePrograms, isLoading } = useServicePrograms(visitLocation?.uuid);

  // If the visit location changes and any currently-selected service isn't offered there
  // anymore, drop it instead of silently submitting a now-invalid service.
  useEffect(() => {
    const selected = getValues('serviceProgram') ?? [];
    if (!isLoading && selected.length) {
      const stillOffered = selected.filter((uuid) => servicePrograms.some((program) => program.uuid === uuid));
      if (stillOffered.length !== selected.length) {
        setValue('serviceProgram', stillOffered, { shouldValidate: true, shouldDirty: true });
      }
    }
  }, [servicePrograms, isLoading, getValues, setValue]);

  return (
    <section data-testid="service-combo">
      <div className={styles.sectionTitle}>{t('service', 'Service')}</div>
      <div className={classNames(styles.selectContainer, styles.sectionField)}>
        <Controller
          control={control}
          name="serviceProgram"
          render={({ field: { onBlur, onChange, value }, fieldState: { error } }) => (
            <MultiSelect
              aria-label={t('selectServices', 'Select services')}
              id="service"
              invalid={Boolean(error)}
              invalidText={error?.message ?? t('fieldRequired', 'This field is required')}
              items={servicePrograms}
              itemToString={(program: ServiceProgram) => program?.display ?? ''}
              label={t('selectServices', 'Select services')}
              onBlur={onBlur}
              onChange={({ selectedItems }: { selectedItems: Array<ServiceProgram> }) =>
                onChange(selectedItems.map((program) => program.uuid))
              }
              selectedItems={servicePrograms.filter((program) => (value ?? []).includes(program.uuid))}
              titleText={t('selectServices', 'Select services')}
            />
          )}
        />
      </div>
    </section>
  );
};

export default ServiceSelector;
