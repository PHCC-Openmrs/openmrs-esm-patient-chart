import React from 'react';
import { useTranslation } from 'react-i18next';
import NursingSections from './nursing-sections/nursing-sections.component';

interface NursingOverviewProps {
  patientUuid: string;
}

/**
 * The Nursing widget on the patient summary: the same tables as the Nursing dashboard, cut to
 * the most recent records with a link through to the full page.
 */
const NursingOverview: React.FC<NursingOverviewProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const pageUrl = `$\{openmrsSpaBase}/patient/${patientUuid}/chart/nursing`;

  return <NursingSections patientUuid={patientUuid} pageSize={5} pageUrl={pageUrl} urlLabel={t('seeAll', 'See all')} />;
};

export default NursingOverview;
