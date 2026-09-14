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
import {
  launchWorkspace2,
  formatDate,
  formatDatetime,
  useConfig,
  usePagination,
  useSession,
  userHasAccess,
} from '@openmrs/esm-framework';
import { CardHeader, EmptyState, ErrorState, PatientChartPagination } from '@openmrs/esm-patient-common-lib';
import { type ConfigObject, type ProgramSectionConfig } from '../config-schema';
import { useEnrollments } from '../programs/programs.resource';
import { useProgramSummaryWidgetRules } from '../programs/program-summary-widget-rules';
import {
  findObsValue,
  type ProgramSectionEncounter,
  useProgramSectionEncounters,
  usePatientAge,
} from './program-section.resource';
import { ProgramSectionActionMenu } from './program-section-action-menu.component';
import styles from './program-sections-overview.scss';

const PAGE_SIZE = 5;

interface ProgramSectionsOverviewProps {
  patientUuid: string;
}

interface ProgramSectionCardProps {
  patientUuid: string;
  section: ProgramSectionConfig;
  isActive: boolean;
}

const ProgramSectionCard: React.FC<ProgramSectionCardProps> = ({ patientUuid, section, isActive }) => {
  const { t } = useTranslation();
  const { encounters, error, isLoading } = useProgramSectionEncounters(patientUuid, section.encounterTypeUuid);
  const { age, isLoading: isLoadingAge } = usePatientAge(patientUuid);
  const session = useSession();
  // Editing is only offered for the enrollment episode that's currently active -- a completed
  // enrollment's section still shows its history, but as a read-only record of that visit.
  const canAddSection = isActive && userHasAccess('Task: patientChart.recordProgramSection', session?.user);

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
        launchForm={canAddSection ? launchForm : undefined}
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
    { key: 'actions', header: '' },
  ];

  const tableRows = paginatedEncounters.map((encounter) => ({
    id: encounter.uuid,
    date: formatDatetime(new Date(encounter.encounterDatetime)),
    ...Object.fromEntries(visibleFields.map((field) => [field.conceptUuid, formatFieldValue(encounter, field)])),
    actions: (
      <ProgramSectionActionMenu encounter={encounter} section={section} patientUuid={patientUuid} isActive={isActive} />
    ),
  }));

  return (
    <div className={styles.widgetCard}>
      <CardHeader title={section.sectionTitle}>
        {canAddSection && (
          <Button kind="ghost" onClick={launchForm}>
            {t('add', 'Add')}
          </Button>
        )}
      </CardHeader>
      <DataTable rows={tableRows} headers={tableHeaders} size="sm" useZebraStyles>
        {({ rows, headers, getHeaderProps, getRowProps, getTableProps }) => (
          // A wide section (Ultrasound records 17 fields) scrolls sideways rather than
          // squeezing every column or pushing the chart's own layout out.
          <TableContainer className={styles.tableContainer}>
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
  const { data: enrollments, activeEnrollments } = useEnrollments(patientUuid);

  // Co-located here (rather than a separate always-present extension) since this widget
  // already knows the patient's active enrollments -- see program-summary-widget-rules.ts
  // for why this needs the imperative attach/detach API instead of a declarative condition.
  useProgramSummaryWidgetRules(patientUuid);

  // A section's widget stays visible for the life of the patient's history with that service --
  // not just while it's active -- so a completed enrollment (e.g. a past SRH episode) still
  // shows its recorded data. Only the active set below gates whether it can be edited.
  const enrolledProgramNames = useMemo(
    () => new Set((enrollments ?? []).map((enrollment) => enrollment.program?.name)),
    [enrollments],
  );

  const activeProgramNames = useMemo(
    () => new Set((activeEnrollments ?? []).map((enrollment) => enrollment.program?.name)),
    [activeEnrollments],
  );

  const eligibleSections = programSections.filter((section) => enrolledProgramNames.has(section.programName));

  if (!eligibleSections.length) {
    return null;
  }

  return (
    <div className={styles.container}>
      {eligibleSections.map((section) => (
        // A program can contribute several sections (SRH has Assessment, Ultrasound, STI and
        // Gyna, and Family Planning), so the encounter type -- not the program -- identifies one.
        <ProgramSectionCard
          key={section.encounterTypeUuid}
          patientUuid={patientUuid}
          section={section}
          isActive={activeProgramNames.has(section.programName)}
        />
      ))}
    </div>
  );
};

export default ProgramSectionsOverview;
