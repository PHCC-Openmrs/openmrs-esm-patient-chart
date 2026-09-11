import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import NursingWidget, { type NursingWidgetColumn } from '../nursing-widget/nursing-widget.component';
import { type NursingRecord } from '../common/types';
import styles from '../nursing-widget/nursing-widget.scss';

interface NursingProceduresOverviewProps {
  patientUuid: string;
  pageSize?: number;
  pageUrl?: string;
  urlLabel?: string;
}

const NursingProceduresOverview: React.FC<NursingProceduresOverviewProps> = ({
  patientUuid,
  pageSize,
  pageUrl,
  urlLabel,
}) => {
  const { t } = useTranslation();

  const columns: Array<NursingWidgetColumn> = useMemo(
    () => [
      {
        key: 'imInjection',
        header: t('imInjection', 'IM injection'),
        render: (record) =>
          record.imInjection ? <span className={styles.wrappedText}>{record.imInjection}</span> : '--',
      },
      {
        key: 'ivInjection',
        header: t('ivInjection', 'IV injection'),
        render: (record) =>
          record.ivInjection ? <span className={styles.wrappedText}>{record.ivInjection}</span> : '--',
      },
      {
        key: 'oral',
        header: t('oral', 'Oral'),
        render: (record) => (record.oral ? <span className={styles.wrappedText}>{record.oral}</span> : '--'),
      },
      {
        key: 'nebulization',
        header: t('nebulization', 'Nebulization'),
        render: (record) =>
          record.nebulization ? <span className={styles.wrappedText}>{record.nebulization}</span> : '--',
      },
    ],
    [t],
  );

  const hasContent = useCallback(
    (record: NursingRecord) =>
      Boolean(record.imInjection) ||
      Boolean(record.ivInjection) ||
      Boolean(record.oral) ||
      Boolean(record.nebulization),
    [],
  );

  return (
    <NursingWidget
      patientUuid={patientUuid}
      headerTitle={t('nursingProcedures', 'Nursing Procedures')}
      displayText={t('nursingProcedureRecords', 'nursing procedure records')}
      columns={columns}
      hasContent={hasContent}
      pageSize={pageSize}
      pageUrl={pageUrl}
      urlLabel={urlLabel}
    />
  );
};

export default NursingProceduresOverview;
