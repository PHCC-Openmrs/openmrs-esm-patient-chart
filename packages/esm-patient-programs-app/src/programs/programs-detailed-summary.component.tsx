import React, { useMemo } from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableSkeleton,
  InlineLoading,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import {
  type ConfigObject,
  formatDate,
  useConfig,
  useLayoutType,
  isDesktop as desktopLayout,
} from '@openmrs/esm-framework';
import { CardHeader, EmptyState, ErrorState } from '@openmrs/esm-patient-common-lib';
import { findLastState, groupEnrollmentsByProgram, usePrograms } from './programs.resource';
import { ProgramsActionMenu } from './programs-action-menu.component';
import styles from './programs-detailed-summary.scss';

interface ProgramsDetailedSummaryProps {
  patientUuid: string;
}

const ProgramsDetailedSummary: React.FC<ProgramsDetailedSummaryProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { showProgramStatusField } = useConfig<ConfigObject>();
  const layout = useLayoutType();
  const isTablet = layout === 'tablet';
  const isDesktop = desktopLayout(layout);
  const displayText = t('programEnrollmentsLower', 'service enrollments');
  const headerTitle = t('carePrograms', 'Care Services');

  const { enrollments, isLoading, error, isValidating } = usePrograms(patientUuid);

  const groupedEnrollments = useMemo(() => groupEnrollmentsByProgram(enrollments), [enrollments]);

  const tableHeaders = useMemo(() => {
    const headers = [
      {
        key: 'display',
        header: t('activePrograms', 'Active services'),
      },
      {
        key: 'location',
        header: t('location', 'Location'),
      },
      {
        key: 'count',
        header: t('count', 'Count'),
      },
      {
        key: 'lastDate',
        header: t('lastDate', 'Last date'),
      },
      {
        key: 'status',
        header: t('status', 'Status'),
      },
    ];
    if (showProgramStatusField) {
      headers.push({
        key: 'state',
        header: t('serviceStatus', 'Service status'),
      });
    }
    return headers;
  }, [t, showProgramStatusField]);

  const tableRows = useMemo(
    () =>
      groupedEnrollments.map((group) => {
        const state = group ? findLastState(group.states ?? []) : null;
        return {
          id: group.uuid,
          display: group.display,
          location: group.location?.display ?? '--',
          count: group.count,
          lastDate: formatDate(new Date(group.lastDateEnrolled)),
          status: group.dateCompleted
            ? `${t('completedOn', 'Completed On')} ${formatDate(new Date(group.dateCompleted))}`
            : t('active', 'Active'),
          state: state ? state.state.concept.display : '--',
        };
      }),
    [groupedEnrollments, t],
  );

  const groupsByUuid = useMemo(
    () => new Map(groupedEnrollments.map((group) => [group.uuid, group])),
    [groupedEnrollments],
  );

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" compact={isDesktop} zebra />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  if (groupedEnrollments.length) {
    return (
      <div className={styles.widgetCard}>
        <CardHeader title={headerTitle}>
          <span>{isValidating ? <InlineLoading /> : null}</span>
        </CardHeader>
        <DataTable rows={tableRows} headers={tableHeaders} isSortable size={isTablet ? 'lg' : 'sm'} useZebraStyles>
          {({ rows, headers, getHeaderProps, getTableProps, getRowProps }) => (
            <TableContainer>
              <Table aria-label="service enrollments" {...getTableProps()}>
                <TableHead>
                  <TableRow>
                    {headers.map((header) => (
                      <TableHeader
                        className={classNames(styles.productiveHeading01, styles.text02)}
                        {...getHeaderProps({
                          header,
                        })}
                      >
                        {header.header}
                      </TableHeader>
                    ))}
                    <TableHeader />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    const group = groupsByUuid.get(row.id);

                    return (
                      <TableRow key={row.id} {...getRowProps({ row })}>
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id}>{cell.value?.content ?? cell.value}</TableCell>
                        ))}
                        {group && (
                          <TableCell className="cds--table-column-menu">
                            <ProgramsActionMenu patientUuid={patientUuid} programEnrollmentId={group.uuid} />
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
      </div>
    );
  }

  return <EmptyState displayText={displayText} headerTitle={headerTitle} />;
};

export default ProgramsDetailedSummary;
