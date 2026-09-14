import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import NursingWidget, { type NursingWidgetColumn } from '../nursing-widget/nursing-widget.component';
import { type NursingRecord } from '../common/types';
import styles from '../nursing-widget/nursing-widget.scss';

interface DressingOverviewProps {
  patientUuid: string;
  pageSize?: number;
  pageUrl?: string;
  urlLabel?: string;
}

const DressingOverview: React.FC<DressingOverviewProps> = ({ patientUuid, pageSize, pageUrl, urlLabel }) => {
  const { t } = useTranslation();

  const columns: Array<NursingWidgetColumn> = useMemo(
    () => [
      {
        key: 'typeOfWound',
        header: t('typeOfWound', 'Type of wound'),
        render: (record) =>
          record.typeOfWound ? <span className={styles.wrappedText}>{record.typeOfWound}</span> : '--',
      },
      {
        key: 'ointment',
        header: t('ointment', 'Ointment'),
        render: (record) =>
          record.ointments.length ? (
            // One obs per selected ointment, so a record can carry several.
            <span className={styles.multiValue}>
              {record.ointments.map((ointment, index) => (
                <span key={index}>{ointment}</span>
              ))}
            </span>
          ) : (
            '--'
          ),
      },
      {
        key: 'dressingGeneralNotes',
        header: t('generalNotes', 'General notes'),
        render: (record) =>
          record.dressingGeneralNotes ? (
            <span className={styles.wrappedText}>{record.dressingGeneralNotes}</span>
          ) : (
            '--'
          ),
      },
    ],
    [t],
  );

  const hasContent = useCallback(
    (record: NursingRecord) =>
      Boolean(record.typeOfWound) || record.ointments.length > 0 || Boolean(record.dressingGeneralNotes),
    [],
  );

  return (
    <NursingWidget
      patientUuid={patientUuid}
      headerTitle={t('dressing', 'Dressing')}
      displayText={t('dressingRecords', 'dressing records')}
      columns={columns}
      hasContent={hasContent}
      pageSize={pageSize}
      pageUrl={pageUrl}
      urlLabel={urlLabel}
    />
  );
};

export default DressingOverview;
