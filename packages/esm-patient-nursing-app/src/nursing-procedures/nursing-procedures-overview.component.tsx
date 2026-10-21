import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import NursingWidget, { type NursingWidgetColumn } from '../nursing-widget/nursing-widget.component';
import { formatProcedure, nursingProcedures, type NursingProcedure } from '../common';
import { type NursingRecord } from '../common/types';
import styles from '../nursing-widget/nursing-widget.scss';

/** The drug and quantity given for a procedure, or the older free-text answer recorded before them. */
function procedureText(record: NursingRecord, procedure: NursingProcedure): string | undefined {
  return formatProcedure(record[`${procedure}Drug`], record[`${procedure}Qty`], record[procedure]);
}

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
    () =>
      [
        { key: 'imInjection', header: t('imInjection', 'IM injection') },
        { key: 'ivInjection', header: t('ivInjection', 'IV injection') },
        { key: 'oral', header: t('oral', 'Oral') },
        { key: 'nebulization', header: t('nebulization', 'Nebulization') },
      ].map(({ key, header }) => ({
        key,
        header,
        render: (record: NursingRecord) => {
          const text = procedureText(record, key as NursingProcedure);
          return text ? <span className={styles.wrappedText}>{text}</span> : '--';
        },
      })),
    [t],
  );

  const hasContent = useCallback(
    (record: NursingRecord) => nursingProcedures.some((procedure) => Boolean(procedureText(record, procedure))),
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
