import React, { useMemo } from 'react';
import {
  DataTable,
  DataTableSkeleton,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { type Order } from '@openmrs/esm-patient-common-lib';
import { useConfig, useLayoutType } from '@openmrs/esm-framework';
import { type ConfigObject } from '../config-schema';
import { getObservationDisplayValue, interpretRangeResult } from '../utils';
import { flattenPanelResults, useLabEncounter, useOrderConceptByUuid } from '../lab-results/lab-results.resource';
import styles from './general-order-table.scss';

interface GeneralOrderProps {
  order: Order;
}

const GeneralOrderTable: React.FC<GeneralOrderProps> = ({ order }) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const { rangeResultConcepts } = useConfig<ConfigObject>();
  const { concept, isLoading: isLoadingConcept } = useOrderConceptByUuid(order.concept.uuid);
  const { encounter, isLoading: isLoadingResult } = useLabEncounter(order.encounter?.uuid);

  const tableHeaders: Array<{ key: string; header: string }> = [
    {
      key: 'orderName',
      header: order?.orderType?.display,
    },
    {
      key: 'instructions',
      header: t('instructions', 'Instructions'),
    },
    {
      key: 'referenceNumber',
      header: t('referenceNumberTableHeader', '{{orderType}} reference number', {
        orderType: order?.orderType?.display,
      }),
    },
  ];

  const obs = useMemo(() => {
    if (encounter && concept) {
      return encounter.obs?.find((obs) => obs.concept.uuid === concept.uuid);
    }
  }, [concept, encounter]);

  const rows = useMemo(() => {
    if (concept && concept.setMembers.length > 0) {
      return flattenPanelResults(concept, obs, rangeResultConcepts).map(
        ({ concept: memberConcept, obs: memberObs, isHeading, range }) => {
          if (range) {
            const { displayValue, ranges } = interpretRangeResult(range);
            return {
              id: memberConcept.uuid,
              orderName: <div className={styles.type}>{memberConcept.display}</div>,
              instructions: '--',
              result: isLoadingResult ? <SkeletonText /> : displayValue,
              normalRange:
                ranges.hiNormal && ranges.lowNormal
                  ? `${ranges.lowNormal} - ${ranges.hiNormal}`
                  : t('notApplicable', 'Not applicable'),
              referenceNumber: order?.accessionNumber,
            };
          }
          return isHeading
            ? {
                id: memberConcept.uuid,
                orderName: (
                  <div className={styles.type}>
                    <strong>{memberConcept.display}</strong>
                  </div>
                ),
                instructions: '',
                result: '',
                normalRange: '',
                referenceNumber: '',
              }
            : {
                id: memberConcept.uuid,
                orderName: <div className={styles.type}>{memberConcept.display}</div>,
                instructions: '--',
                result: isLoadingResult ? <SkeletonText /> : getObservationDisplayValue(memberObs?.value) ?? '--',
                normalRange:
                  memberConcept.hiNormal && memberConcept.lowNormal
                    ? `${memberConcept.lowNormal} - ${memberConcept.hiNormal}`
                    : t('notApplicable', 'Not applicable'),
                referenceNumber: order?.accessionNumber,
              };
        },
      );
    } else if (concept && concept.setMembers.length === 0) {
      return [
        {
          id: concept.uuid,
          orderName: <div className={styles.type}>{concept.display}</div>,
          instructions: order?.instructions ?? '--',
          result: isLoadingResult ? <SkeletonText /> : getObservationDisplayValue(obs?.value) ?? '--',
          normalRange:
            concept.hiNormal && concept.lowNormal
              ? `${concept.lowNormal} - ${concept.hiNormal}`
              : t('notApplicable', 'Not applicable'),
          referenceNumber: order?.accessionNumber,
        },
      ];
    } else {
      return [];
    }
  }, [concept, isLoadingResult, obs, order?.accessionNumber, order?.instructions, rangeResultConcepts, t]);

  return (
    <div className={styles.order}>
      {isLoadingConcept ? (
        <DataTableSkeleton role="progressbar" compact={isTablet} zebra />
      ) : (
        <DataTable rows={rows} headers={tableHeaders} size={isTablet ? 'lg' : 'sm'} useZebraStyles>
          {({ rows, headers, getHeaderProps, getRowProps, getTableProps, getTableContainerProps }) => (
            <TableContainer {...getTableContainerProps()}>
              <Table {...getTableProps()} aria-label="orders">
                <TableHead>
                  <TableRow>
                    {headers.map((header) => (
                      <TableHeader {...getHeaderProps({ header })}>{header.header}</TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow {...getRowProps({ row })}>
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id} className={styles.cell}>
                          {cell.value}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
      )}
    </div>
  );
};

export default GeneralOrderTable;
