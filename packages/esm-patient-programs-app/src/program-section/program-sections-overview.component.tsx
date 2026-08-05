import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DataTable,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { launchWorkspace2, formatDate, formatDatetime, useConfig, usePagination } from '@openmrs/esm-framework';
import { CardHeader, EmptyState, ErrorState, PatientChartPagination } from '@openmrs/esm-patient-common-lib';
import { type ConfigObject, type ProgramSectionConfig } from '../config-schema';
import { useEnrollments } from '../programs/programs.resource';
import { useProgramSummaryWidgetRules } from '../programs/program-summary-widget-rules';
import { findObsValue, type ProgramSectionEncounter, useProgramSectionEncounters, usePatientAge } from './program-section.resource';
import styles from './program-sections-overview.scss';

const PAGE_SIZE = 5;

interface ProgramSectionsOverviewProps {
  patientUuid: string;
}

interface ProgramSectionCardProps {
  patientUuid: string;
  section: ProgramSectionConfig;
}

const ProgramSectionCard: React.FC<ProgramSectionCardProps> = ({ patientUuid, section }) => {
  const { t } = useTranslation();
  const { encounters, error, isLoading } = useProgramSectionEncounters(patientUuid, section.encounterTypeUuid);
  const { age, isLoading: isLoadingAge } = usePatientAge(patientUuid);

  // Some fields (e.g. Diagnosis) have two config entries sharing the same concept, one per
  // age band -- only one is ever visible for a given patient, so keying by conceptUuid below
  // never collides at runtime.
  const visibleFields = useMemo(
    () => section.fields.filter((field) => age != null && age >= field.minAge && age <= field.maxAge),
    [section.fields, age],
  );

  const { results: paginatedEncounters, goTo, currentPage } = usePagination(encounters ?? [], PAGE_SIZE);

  const launchForm = () =>
    launchWorkspace2('program-section-form-workspace', {
      workspaceTitle: t('recordSection', 'Record {{sectionTitle}}', { sectionTitle: section.sectionTitle }),
      section,
    });

  if (isLoading || isLoadingAge) {
    return null;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={section.sectionTitle} />;
  }

  if (!encounters.length) {
    return (
      <EmptyState
        displayText={section.sectionTitle.toLowerCase()}
        headerTitle={section.sectionTitle}
        launchForm={launchForm}
      />
    );
  }

  const formatFieldValue = (encounter: ProgramSectionEncounter, field: (typeof visibleFields)[number]) => {
    const rawValue = findObsValue(encounter, field.conceptUuid);
    return field.controlType === 'date' && rawValue !== '--' ? formatDate(new Date(rawValue)) : rawValue;
  };

  const tableHeaders = [
    { key: 'date', header: t('dateAndTime', 'Date and time') },
    ...visibleFields.map((field) => ({ key: field.conceptUuid, header: field.label })),
  ];

  const tableRows = paginatedEncounters.map((encounter) => ({
    id: encounter.uuid,
    date: formatDatetime(new Date(encounter.encounterDatetime)),
    ...Object.fromEntries(visibleFields.map((field) => [field.conceptUuid, formatFieldValue(encounter, field)])),
  }));

  return (
    <div className={styles.widgetCard}>
      <CardHeader title={section.sectionTitle}>
        <Button kind="ghost" onClick={launchForm}>
          {t('add', 'Add')}
        </Button>
      </CardHeader>
      <DataTable rows={tableRows} headers={tableHeaders} size="sm" useZebraStyles>
        {({ rows, headers, getHeaderProps, getRowProps, getTableProps }) => (
          <TableContainer>
            <Table aria-label={section.sectionTitle} {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader {...getHeaderProps({ header })}>{header.header}</TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} {...getRowProps({ row })}>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
      <PatientChartPagination
        currentItems={paginatedEncounters.length}
        onPageNumberChange={({ page }) => goTo(page)}
        pageNumber={currentPage}
        pageSize={PAGE_SIZE}
        totalItems={encounters.length}
      />
    </div>
  );
};

const ProgramSectionsOverview: React.FC<ProgramSectionsOverviewProps> = ({ patientUuid }) => {
  const { programSections } = useConfig<ConfigObject>();
  const { activeEnrollments } = useEnrollments(patientUuid);

  // Co-located here (rather than a separate always-present extension) since this widget
  // already knows the patient's active enrollments -- see program-summary-widget-rules.ts
  // for why this needs the imperative attach/detach API instead of a declarative condition.
  useProgramSummaryWidgetRules(patientUuid);

  const activeProgramNames = useMemo(
    () => new Set((activeEnrollments ?? []).map((enrollment) => enrollment.program?.name)),
    [activeEnrollments],
  );

  const eligibleSections = programSections.filter((section) => activeProgramNames.has(section.programName));

  if (!eligibleSections.length) {
    return null;
  }

  return (
    <div className={styles.container}>
      {eligibleSections.map((section) => (
        <ProgramSectionCard key={section.programName} patientUuid={patientUuid} section={section} />
      ))}
    </div>
  );
};

export default ProgramSectionsOverview;
