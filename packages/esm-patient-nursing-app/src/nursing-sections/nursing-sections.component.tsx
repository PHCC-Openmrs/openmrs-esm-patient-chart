import React from 'react';
import DressingOverview from '../dressing/dressing-overview.component';
import NursingProceduresOverview from '../nursing-procedures/nursing-procedures-overview.component';
import styles from './nursing-sections.scss';

interface NursingSectionsProps {
  patientUuid: string;
  pageSize?: number;
  pageUrl?: string;
  urlLabel?: string;
}

/**
 * The two cards for the nursing form's three sections -- Dressing and Other Measures share one
 * table, Nursing Procedures gets its own. A nursing encounter can record any mix of the three,
 * so both cards have to be rendered for a saved record to be visible somewhere.
 */
const NursingSections: React.FC<NursingSectionsProps> = ({ patientUuid, pageSize, pageUrl, urlLabel }) => {
  const sectionProps = { patientUuid, pageSize, pageUrl, urlLabel };

  return (
    <div className={styles.sections}>
      <DressingOverview {...sectionProps} />
      <NursingProceduresOverview {...sectionProps} />
    </div>
  );
};

export default NursingSections;
