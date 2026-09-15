import React from 'react';
import NursingProceduresOverview from '../nursing-procedures/nursing-procedures-overview.component';
import styles from './nursing-sections.scss';

interface NursingSectionsProps {
  patientUuid: string;
  pageSize?: number;
  pageUrl?: string;
  urlLabel?: string;
}

/**
 * Nursing procedure records for the patient. Dressing and Other Measures fields can still be
 * recorded via the shared nursing form, but are no longer shown as separate cards here since
 * they all launched the same combined form.
 */
const NursingSections: React.FC<NursingSectionsProps> = ({ patientUuid, pageSize, pageUrl, urlLabel }) => {
  const sectionProps = { patientUuid, pageSize, pageUrl, urlLabel };

  return (
    <div className={styles.sections}>
      <NursingProceduresOverview {...sectionProps} />
    </div>
  );
};

export default NursingSections;
