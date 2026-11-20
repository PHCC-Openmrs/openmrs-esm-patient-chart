import React, { Fragment, useId, useState } from 'react';
import classNames from 'classnames';
import { type Control, Controller } from 'react-hook-form';
import { FormLabel, NumberInput, Select, SelectItem, TextArea } from '@carbon/react';
import { Warning } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';
import { useLayoutType, ResponsiveWrapper } from '@openmrs/esm-framework';
import { generatePlaceholder } from '../common';
import { type VitalsBiometricsFormData } from './schema';
import styles from './vitals-biometrics-input.scss';

type fieldId =
  | 'bloodGlucose'
  | 'bloodGroup'
  | 'computedBodyMassIndex'
  | 'diastolicBloodPressure'
  | 'generalPatientNote'
  | 'height'
  | 'hemoglobin'
  | 'midUpperArmCircumference'
  | 'oxygenSaturation'
  | 'pulse'
  | 'respiratoryRate'
  | 'systolicBloodPressure'
  | 'temperature'
  | 'weight';

type AbnormalValue = 'critically_low' | 'critically_high' | 'high' | 'low';
type FieldTypes = 'number' | 'select' | 'textarea';

interface VitalsAndBiometricsInputProps {
  control: Control<VitalsBiometricsFormData>;
  fieldStyles?: React.CSSProperties;
  fieldWidth?: string;
  fieldProperties: Array<{
    className?: string;
    id: fieldId;
    invalid?: boolean;
    max?: number | null;
    min?: number | null;
    name: string;
    /** Choices for a `select` field; the value saved is the option's `value` (an answer concept uuid). */
    options?: Array<{ value: string; label: string }>;
    separator?: string;
    type?: FieldTypes;
  }>;
  interpretation?: string;
  isValueWithinReferenceRange?: boolean;
  label: string;
  muacColorCode?: string;
  placeholder?: string;
  readOnly?: boolean;
  showErrorMessage?: boolean;
  unitSymbol?: string;
  useMuacColors?: boolean;
}

const VitalsAndBiometricsInput: React.FC<VitalsAndBiometricsInputProps> = ({
  control,
  fieldProperties,
  fieldStyles,
  fieldWidth,
  interpretation,
  isValueWithinReferenceRange = true,
  label,
  muacColorCode,
  placeholder,
  readOnly,
  showErrorMessage,
  unitSymbol,
  useMuacColors,
}) => {
  const { t } = useTranslation();
  const fieldId = useId();
  const isTablet = useLayoutType() === 'tablet';
  const [invalid, setInvalid] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const abnormalValues: Array<AbnormalValue> = ['critically_low', 'critically_high', 'high', 'low'];
  const hasAbnormalValue = !isFocused && interpretation && abnormalValues.includes(interpretation as AbnormalValue);

  function checkValidity(value, onChange) {
    const isInvalid = value !== '' && isNaN(Number(value));
    setInvalid(isInvalid);

    if (!isInvalid) {
      onChange(value === '' ? undefined : Number(value));
    }
  }

  // Only digits, a decimal point and (when negatives are allowed) a minus sign may be typed or pasted.
  function isAllowedText(text: string, allowNegative: boolean) {
    return (allowNegative ? /^-?[0-9]*\.?[0-9]*$/ : /^[0-9]*\.?[0-9]*$/).test(text);
  }

  function blockNonNumericKey(event: React.KeyboardEvent<HTMLInputElement>, allowNegative: boolean) {
    if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) {
      return;
    }
    if (!isAllowedText(event.key, allowNegative)) {
      event.preventDefault();
    }
  }

  function blockNonNumericPaste(event: React.ClipboardEvent<HTMLInputElement>, allowNegative: boolean) {
    if (!isAllowedText(event.clipboardData.getData('text').trim(), allowNegative)) {
      event.preventDefault();
    }
  }

  function handleFocusChange(isFocused: boolean) {
    setIsFocused(isFocused);
  }

  const isInvalidInput = !isValueWithinReferenceRange || invalid;
  const showInvalidInputError = Boolean(showErrorMessage && isInvalidInput);
  const errorMessageClass = showInvalidInputError ? styles.invalidInput : '';

  const containerClasses = classNames(styles.container, {
    [styles.inputInTabletView]: isTablet,
    [styles.inputWithAbnormalValue]: hasAbnormalValue,
  });

  const inputClasses = classNames(styles.inputContainer, {
    [styles['critical-value']]: hasAbnormalValue,
    [styles.focused]: isFocused,
    [styles.readonly]: readOnly,
    [muacColorCode]: useMuacColors,
    [errorMessageClass]: true,
  });

  return (
    <>
      <div className={containerClasses} style={{ width: fieldWidth }}>
        <section className={styles.labelContainer}>
          <span className={styles.label} id={`${fieldId}-label`}>
            {label}
          </span>

          {Boolean(hasAbnormalValue) ? (
            <span className={styles[interpretation.replace('_', '-')]} title={t('abnormalValue', 'Abnormal value')} />
          ) : null}

          {showInvalidInputError ? (
            <span className={styles.invalidInputIcon}>
              <Warning />
            </span>
          ) : null}
        </section>
        <section className={inputClasses} style={{ ...fieldStyles }}>
          <div
            className={classNames({
              [styles.centered]: !isTablet || unitSymbol === 'mmHg',
            })}
          >
            {fieldProperties.map((fieldProperty) => {
              if (fieldProperty.type === 'number') {
                const numberInputClasses = classNames(styles.numberInput, fieldProperty.className);

                return (
                  <Fragment key={fieldProperty.id}>
                    <ResponsiveWrapper>
                      <Controller
                        name={fieldProperty.id}
                        control={control}
                        render={({ field: { onChange, ref, value } }) => {
                          return (
                            <NumberInput
                              allowEmpty
                              className={numberInputClasses}
                              disableWheel
                              hideSteppers
                              id={`${fieldId}-${fieldProperty.id}`}
                              max={fieldProperty.max ?? undefined}
                              min={fieldProperty.min ?? undefined}
                              name={fieldProperty.name}
                              onBlur={() => handleFocusChange(false)}
                              onChange={(event, { value }) => checkValidity(value, onChange)}
                              onFocus={() => handleFocusChange(true)}
                              onKeyDown={(event) => blockNonNumericKey(event, !(fieldProperty.min >= 0))}
                              onPaste={(event) => blockNonNumericPaste(event, !(fieldProperty.min >= 0))}
                              placeholder={generatePlaceholder(fieldProperty.name)}
                              readOnly={readOnly}
                              ref={ref}
                              style={{ ...fieldStyles }}
                              title={fieldProperty.name}
                              type="number"
                              value={value ?? ''}
                            />
                          );
                        }}
                      />
                    </ResponsiveWrapper>
                    {fieldProperty?.separator}
                  </Fragment>
                );
              }

              if (fieldProperty.type === 'select') {
                return (
                  <ResponsiveWrapper key={fieldProperty.id}>
                    <Controller
                      name={fieldProperty.id}
                      control={control}
                      render={({ field: { onChange, ref, value } }) => (
                        <Select
                          className={styles.select}
                          id={`${fieldId}-${fieldProperty.id}`}
                          labelText=""
                          aria-labelledby={`${fieldId}-label`}
                          name={fieldProperty.name}
                          onBlur={() => handleFocusChange(false)}
                          onChange={(event) => onChange(event.target.value === '' ? undefined : event.target.value)}
                          onFocus={() => handleFocusChange(true)}
                          readOnly={readOnly}
                          ref={ref}
                          title={fieldProperty.name}
                          value={(value as string) ?? ''}
                        >
                          <SelectItem text={t('selectOption', 'Select')} value="" />
                          {fieldProperty.options?.map((option) => (
                            <SelectItem key={option.value} text={option.label} value={option.value} />
                          ))}
                        </Select>
                      )}
                    />
                  </ResponsiveWrapper>
                );
              }

              if (fieldProperty.type === 'textarea') {
                return (
                  <ResponsiveWrapper key={fieldProperty.id}>
                    <Controller
                      name={fieldProperty.id}
                      control={control}
                      render={({ field: { onChange, ref, value } }) => (
                        <TextArea
                          className={styles.textarea}
                          id={`${fieldId}-${fieldProperty.id}`}
                          labelText={''}
                          aria-labelledby={`${fieldId}-label`}
                          maxCount={100}
                          name={fieldProperty.name}
                          onBlur={() => handleFocusChange(false)}
                          onChange={onChange}
                          onFocus={() => handleFocusChange(true)}
                          placeholder={placeholder}
                          ref={ref}
                          rows={2}
                          style={{ ...fieldStyles }}
                          title={fieldProperty.name}
                          value={value ?? ''}
                        />
                      )}
                    />
                  </ResponsiveWrapper>
                );
              }
            })}
          </div>
          {Boolean(unitSymbol) && <p className={styles.unitName}>{unitSymbol}</p>}
        </section>
      </div>

      {showInvalidInputError && (
        <FormLabel className={styles.invalidInputError}>
          {t('validationInputError', `Value must be between {{min}} and {{max}}`, {
            min: fieldProperties[0].min,
            max: fieldProperties[0].max,
          })}
        </FormLabel>
      )}
    </>
  );
};

export default VitalsAndBiometricsInput;
