import React from 'react';
import { useTranslation } from 'react-i18next';
import { DefinitionTooltip, Tag } from '@carbon/react';
import { formatDatetime, parseDate } from '@openmrs/esm-framework';
import { useCauseOfDeath } from '../hooks/useCauseOfDeath';
import styles from './deceased-patient-tag.scss';

interface DeceasedPatientBannerTagProps {
  patient: fhir.Patient;
}

const DeceasedPatientBannerTag: React.FC<DeceasedPatientBannerTagProps> = ({ patient }) => {
  const { t } = useTranslation();
  const isDeceased = Boolean(patient?.deceasedDateTime);
  // This tag sits in every patient banner, including each row of the patient search dropdown, so
  // only ask for the cause of death when there is a death to describe -- otherwise every living
  // patient shown costs a wasted request.
  const { causeOfDeath, nonCodedCauseOfDeath } = useCauseOfDeath(isDeceased ? patient?.id : null);

  if (!isDeceased) return null;

  return (
    <DefinitionTooltip
      align="bottom-left"
      definition={
        <div role="tooltip" className={styles.tooltipPadding}>
          <h6 style={{ marginBottom: '0.5rem' }}>{t('deceased', 'Deceased')}</h6>
          <span>
            {formatDatetime(parseDate(patient?.deceasedDateTime))}
            {nonCodedCauseOfDeath || causeOfDeath
              ? ` ${t('from_lower', 'from')} ${nonCodedCauseOfDeath || causeOfDeath}`
              : null}
          </span>
        </div>
      }
    >
      <Tag className={styles.tagOverride}>{t('deceased', 'Deceased')}</Tag>
    </DefinitionTooltip>
  );
};

export { DeceasedPatientBannerTagProps };
export default DeceasedPatientBannerTag;
