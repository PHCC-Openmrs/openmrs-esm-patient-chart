import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import NursingWidget, { type NursingWidgetColumn } from '../nursing-widget/nursing-widget.component';
import { type ConfigObject } from '../config-schema';
import { getEcgAttachmentSrc, withUnit } from '../common';
import { type NursingRecord } from '../common/types';
import styles from '../nursing-widget/nursing-widget.scss';

interface DressingOverviewProps {
  patientUuid: string;
  pageSize?: number;
  pageUrl?: string;
  urlLabel?: string;
}

/**
 * The Dressing and Other Measures fields recorded on the nursing form, shown as one table.
 * They're separate sections in the form but share a single card here.
 */
const DressingOverview: React.FC<DressingOverviewProps> = ({ patientUuid, pageSize, pageUrl, urlLabel }) => {
  const { t } = useTranslation();
  const { nursing } = useConfig<ConfigObject>();

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
      {
        key: 'ecgImage',
        header: t('ecgResult', 'ECG result'),
        // The obs holds the uuid of the uploaded attachment, so the cell links to the file itself.
        render: (record) =>
          record.ecgImage ? (
            <Link href={getEcgAttachmentSrc(record.ecgImage)} target="_blank" rel="noopener noreferrer">
              {t('viewEcg', 'View ECG')}
            </Link>
          ) : (
            '--'
          ),
      },
      {
        key: 'spirometry',
        header: withUnit(t('spirometry', 'Spirometry'), nursing.spirometryUnit),
        render: (record) => (record.spirometry != null ? String(record.spirometry) : '--'),
      },
      {
        key: 'monofilament',
        header: withUnit(t('monofilament', 'Monofilament'), nursing.monofilamentUnit),
        render: (record) => (record.monofilament != null ? String(record.monofilament) : '--'),
      },
    ],
    [t, nursing.spirometryUnit, nursing.monofilamentUnit],
  );

  const hasContent = useCallback(
    (record: NursingRecord) =>
      Boolean(record.typeOfWound) ||
      record.ointments.length > 0 ||
      Boolean(record.dressingGeneralNotes) ||
      Boolean(record.ecgImage) ||
      record.spirometry != null ||
      record.monofilament != null,
    [],
  );

  return (
    <NursingWidget
      patientUuid={patientUuid}
      headerTitle={t('dressingAndOtherMeasures', 'Dressing and Other Measures')}
      displayText={t('dressingAndOtherMeasuresRecords', 'dressing and other measures records')}
      columns={columns}
      hasContent={hasContent}
      pageSize={pageSize}
      pageUrl={pageUrl}
      urlLabel={urlLabel}
    />
  );
};

export default DressingOverview;
