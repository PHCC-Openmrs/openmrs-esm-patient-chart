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
import { CardHeader, EmptyState, ErrorState, PatientChartPagination } from '@openmrs/esm-patient-common-lib';
import { formatDate, useLayoutType, usePagination, isDesktop as desktopLayout } from '@openmrs/esm-framework';
import { findLastState, groupEnrollmentsByProgram, usePrograms } from './programs.resource';
import styles from './programs-overview.scss';

interface ProgramsOverviewProps {
  basePath: string;
  patientUuid: string;
}

const ProgramsOverview: React.FC<ProgramsOverviewProps> = ({ basePath, patientUuid }) => {
  const programsCount = 5;
  const { t } = useTranslation();
  const displayText = t('programEnrollmentsLower', 'service enrollments');
  const headerTitle = t('carePrograms', 'Care Services');
  const urlLabel = t('seeAll', 'See all');
  const pageUrl = `\${openmrsSpaBase}/patient/${patientUuid}/chart/programs`;
  const layout = useLayoutType();
  const isTablet = layout === 'tablet';
  const isDesktop = desktopLayout(layout);

  const { enrollments, error, isLoading, isValidating } = usePrograms(patientUuid);

  const groupedEnrollments = useMemo(() => groupEnrollmentsByProgram(enrollments), [enrollments]);

  const { results: paginatedGroups, goTo, currentPage } = usePagination(groupedEnrollments, programsCount);

  const tableHeaders = [
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
    {
      key: 'state',
      header: t('state', 'State'),
    },
  ];

  const tableRows = useMemo(() => {
    return paginatedGroups?.map((group) => {
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
    });
  }, [paginatedGroups, t]);

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
          {({ rows, headers, getHeaderProps, getRowProps, getTableProps }) => (
            <TableContainer>
              <Table aria-label="services overview" {...getTableProps()}>
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
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    return (
                      <TableRow key={row.id} {...getRowProps({ row })}>
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id}>{cell.value?.content ?? cell.value}</TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
        <PatientChartPagination
          currentItems={paginatedGroups.length}
          onPageNumberChange={({ page }) => goTo(page)}
          pageNumber={currentPage}
          pageSize={programsCount}
          totalItems={groupedEnrollments.length}
          dashboardLinkUrl={pageUrl}
          dashboardLinkLabel={urlLabel}
        />
      </div>
    );
  }

  return <EmptyState displayText={displayText} headerTitle={headerTitle} />;
};

export default ProgramsOverview;
