import React from 'react';
import { useTranslation } from 'react-i18next';
import type { OverallRisk } from '../common';
import OverallRiskTag from '../components/overall-risk-tag/overall-risk-tag.component';
import styles from './vitals-header-risk-item.scss';

interface VitalsHeaderRiskItemProps {
  overallRisk?: OverallRisk;
  /** The note explaining the risk, shown when a high risk pill is clicked */
  note?: string;
}

/**
 * Header tile for the overall risk, laid out like the numeric vitals tiles
 */
const VitalsHeaderRiskItem: React.FC<VitalsHeaderRiskItemProps> = ({ overallRisk, note }) => {
  const { t } = useTranslation();

  return (
    <section className={styles.container} data-testid="overall-risk-card">
      <span className={styles.label}>{t('overallRisk', 'Overall risk')}</span>
      <div className={styles.value}>
        <OverallRiskTag risk={overallRisk} note={note} />
      </div>
    </section>
  );
};

export default VitalsHeaderRiskItem;
