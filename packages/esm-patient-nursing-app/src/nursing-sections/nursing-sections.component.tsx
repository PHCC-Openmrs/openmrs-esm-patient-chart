import React from 'react';
import DressingOverview from '../dressing/dressing-overview.component';
import OtherMeasuresOverview from '../other-measures/other-measures-overview.component';
import NursingProceduresOverview from '../nursing-procedures/nursing-procedures-overview.component';
import styles from './nursing-sections.scss';

interface NursingSectionsProps {
  patientUuid: string;
  pageSize?: number;
  pageUrl?: string;
  urlLabel?: string;
}

/**
 * The three sections of the nursing form -- Dressing, Other Measures and Nursing Procedures --
 * shown as one table each. A nursing encounter can record any mix of the three, so every
 * section has to be rendered for a saved record to be visible somewhere.
 */
const NursingSections: React.FC<NursingSectionsProps> = ({ patientUuid, pageSize, pageUrl, urlLabel }) => {
  const sectionProps = { patientUuid, pageSize, pageUrl, urlLabel };

  return (
    <div className={styles.sections}>
      <DressingOverview {...sectionProps} />
      <OtherMeasuresOverview {...sectionProps} />
      <NursingProceduresOverview {...sectionProps} />
    </div>
  );
};

export default NursingSections;
