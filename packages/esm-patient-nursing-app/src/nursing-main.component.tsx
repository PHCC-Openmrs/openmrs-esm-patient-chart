import React from 'react';
import { useTranslation } from 'react-i18next';
import NursingProceduresOverview from './nursing-procedures/nursing-procedures-overview.component';

interface NursingMainProps {
  patientUuid: string;
}

/**
 * The Nursing dashboard page. Every nursing encounter is recorded through a single form, so
 * the dashboard shows that list once rather than repeating it per section.
 */
const NursingMain: React.FC<NursingMainProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const pageUrl = `$\{openmrsSpaBase}/patient/${patientUuid}/chart/nursing`;

  return (
    <NursingProceduresOverview
      patientUuid={patientUuid}
      pageSize={10}
      pageUrl={pageUrl}
      urlLabel={t('seeAll', 'See all')}
    />
  );
};

export default NursingMain;
