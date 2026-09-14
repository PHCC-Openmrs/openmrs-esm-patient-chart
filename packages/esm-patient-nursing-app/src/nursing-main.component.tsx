import React from 'react';
import { useTranslation } from 'react-i18next';
import NursingSections from './nursing-sections/nursing-sections.component';

interface NursingMainProps {
  patientUuid: string;
}

/**
 * The Nursing dashboard page. Shows every section of the nursing form as its own table, so a
 * record is visible here whichever sections it filled in.
 */
const NursingMain: React.FC<NursingMainProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const pageUrl = `$\{openmrsSpaBase}/patient/${patientUuid}/chart/nursing`;

  return (
    <NursingSections patientUuid={patientUuid} pageSize={10} pageUrl={pageUrl} urlLabel={t('seeAll', 'See all')} />
  );
};

export default NursingMain;
