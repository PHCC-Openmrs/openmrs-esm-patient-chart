import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import NursingWidget, { type NursingWidgetColumn } from '../nursing-widget/nursing-widget.component';
import { type ConfigObject } from '../config-schema';
import { getEcgAttachmentSrc, withUnit } from '../common';
import { type NursingRecord } from '../common/types';

interface OtherMeasuresOverviewProps {
  patientUuid: string;
  pageSize?: number;
  pageUrl?: string;
  urlLabel?: string;
}

const OtherMeasuresOverview: React.FC<OtherMeasuresOverviewProps> = ({ patientUuid, pageSize, pageUrl, urlLabel }) => {
  const { t } = useTranslation();
  const { nursing } = useConfig<ConfigObject>();

  const columns: Array<NursingWidgetColumn> = useMemo(
    () => [
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
    (record: NursingRecord) => Boolean(record.ecgImage) || record.spirometry != null || record.monofilament != null,
    [],
  );

  return (
    <NursingWidget
      patientUuid={patientUuid}
      headerTitle={t('otherMeasures', 'Other Measures')}
      displayText={t('otherMeasureRecords', 'other measure records')}
      columns={columns}
      hasContent={hasContent}
      pageSize={pageSize}
      pageUrl={pageUrl}
      urlLabel={urlLabel}
    />
  );
};

export default OtherMeasuresOverview;
