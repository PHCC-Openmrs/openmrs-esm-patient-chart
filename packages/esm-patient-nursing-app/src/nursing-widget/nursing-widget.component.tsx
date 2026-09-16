import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableSkeleton,
  InlineLoading,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import {
  AddIcon,
  formatDate,
  parseDate,
  useLayoutType,
  usePagination,
  useSession,
  userHasAccess,
} from '@openmrs/esm-framework';
import { CardHeader, EmptyState, ErrorState, PatientChartPagination } from '@openmrs/esm-patient-common-lib';
import { useNursingRecords } from '../common';
import { type NursingRecord } from '../common/types';
import { useLaunchNursingForm } from '../utils';
import { NursingActionMenu } from '../components/action-menu/nursing-action-menu.component';
import styles from './nursing-widget.scss';

export interface NursingWidgetColumn {
  key: string;
  header: string;
  /** Renders the cell for this column. Returning `null` falls back to a placeholder. */
  render: (record: NursingRecord) => React.ReactNode;
}

interface NursingWidgetProps {
  patientUuid: string;
  /** Title shown in the card header, e.g. "Dressing". */
  headerTitle: string;
  /** Lowercase noun used in the empty state, e.g. "dressing records". */
  displayText: string;
  columns: Array<NursingWidgetColumn>;
  /**
   * Whether a record has anything to show in this section. A nursing encounter that only
   * recorded a procedure shouldn't produce a blank row in the Dressing table.
   */
  hasContent: (record: NursingRecord) => boolean;
  pageSize?: number;
  pageUrl?: string;
  urlLabel?: string;
}

/**
 * The table shared by all three nursing sections. Each section renders the same list of
 * nursing encounters through its own set of columns, filtered down to the encounters that
 * actually recorded something for that section.
 */
const NursingWidget: React.FC<NursingWidgetProps> = ({
  patientUuid,
  headerTitle,
  displayText,
  columns,
  hasContent,
  pageSize = 5,
  pageUrl,
  urlLabel,
}) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const { records, error, isLoading, isValidating } = useNursingRecords(patientUuid);
  const launchNursingForm = useLaunchNursingForm(patientUuid);
  const session = useSession();
  const canRecordNursing = userHasAccess('Task: patientChart.recordNursing', session?.user);

  const sectionRecords = useMemo(() => records?.filter(hasContent) ?? [], [records, hasContent]);

  const tableHeaders = useMemo(
    () => [
      { key: 'date', header: t('dateAndTime', 'Date and time') },
      ...columns.map(({ key, header }) => ({ key, header })),
    ],
    [columns, t],
  );

  const tableRows = useMemo(
    () =>
      sectionRecords.map((record) => {
        const row: Record<string, React.ReactNode> & { id: string } = {
          id: record.id,
          date: formatDate(parseDate(record.date), { mode: 'wide', time: true }),
        };

        for (const column of columns) {
          row[column.key] = column.render(record) ?? '--';
        }

        return row;
      }),
    [sectionRecords, columns],
  );

  const { results: paginatedRows, goTo, currentPage } = usePagination(tableRows, pageSize);

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" compact={!isTablet} zebra />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  if (!sectionRecords.length) {
    return (
      <EmptyState
        displayText={displayText}
        headerTitle={headerTitle}
        launchForm={canRecordNursing ? launchNursingForm : undefined}
      />
    );
  }

  return (
    <div className={styles.widgetCard}>
      <CardHeader title={headerTitle}>
        <span className={styles.backgroundDataFetchingIndicator}>{isValidating ? <InlineLoading /> : null}</span>
        {canRecordNursing && (
          <Button
            kind="ghost"
            renderIcon={AddIcon}
            iconDescription={t('recordNursing', 'Record nursing')}
            onClick={launchNursingForm}
          >
            {t('add', 'Add')}
          </Button>
        )}
      </CardHeader>
      <DataTable
        headers={tableHeaders}
        rows={paginatedRows}
        overflowMenuOnHover={!isTablet}
        size={isTablet ? 'lg' : 'sm'}
        useZebraStyles
      >
        {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
          <TableContainer className={styles.tableContainer}>
            <Table aria-label={headerTitle} className={styles.table} {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader {...getHeaderProps({ header })} key={header.key}>
                      {header.header}
                    </TableHeader>
                  ))}
                  <TableHeader aria-label={t('actions', 'Actions')} />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow {...getRowProps({ row })} key={row.id}>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                    <TableCell className="cds--table-column-menu">
                      <NursingActionMenu patientUuid={patientUuid} encounterUuid={row.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
      <PatientChartPagination
        pageNumber={currentPage}
        totalItems={tableRows.length}
        currentItems={paginatedRows.length}
        pageSize={pageSize}
        onPageNumberChange={({ page }) => goTo(page)}
        dashboardLinkUrl={pageUrl}
        dashboardLinkLabel={urlLabel}
      />
    </div>
  );
};

export default NursingWidget;
