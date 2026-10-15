import { useState, useEffect } from 'react';
import { useConfig } from '@openmrs/esm-framework';
import {
  formatRangeResult,
  type ObsRecord,
  type OBSERVATION_INTERPRETATION,
  worstInterpretation,
} from '@openmrs/esm-patient-common-lib';
import { type ConfigObject } from '../../config-schema';
import usePatientResultsData from '../loadPatientTestData/usePatientResultsData';

export interface OverviewPanelData {
  id: string;
  key?: string;
  name: string;
  range: string;
  interpretation: OBSERVATION_INTERPRETATION;
  value?: {
    interpretation: string;
    value: string | number;
  };
  valueCodeableConcept?: Coding;
}

interface Coding {
  coding: Array<{ code: string; display: string }>;
}

export type OverviewPanelEntry = [string, string, Array<OverviewPanelData>, Date, Date, string];

export function parseSingleEntry(
  entry: ObsRecord,
  type: string,
  panelName: string,
  rangeResultConcepts: Array<string> = [],
): Array<OverviewPanelData> {
  if (type === 'Test') {
    // Use observation-level interpretation set during data loading
    const interpretation = entry.interpretation || 'NORMAL';
    return [
      {
        id: entry.id,
        name: panelName,
        range: entry.meta?.range || '--',
        interpretation,
        value: {
          value: entry.value,
          interpretation,
        },
      },
    ];
  } else if (rangeResultConcepts.includes(entry.conceptClass) && entry.members?.length === 2) {
    // A range test is a single "100 – 120" row: its members are the Lower and Upper bounds, in that order
    const [lower, upper] = entry.members;
    const interpretation = worstInterpretation(lower?.interpretation, upper?.interpretation) || 'NORMAL';
    return [
      {
        id: entry.id,
        key: entry.id,
        name: panelName,
        range: lower?.meta?.range || '--',
        interpretation,
        value: {
          value: formatRangeResult(lower?.value, upper?.value, lower?.meta?.units ?? upper?.meta?.units),
          interpretation,
        },
      },
    ];
  } else {
    return entry.members.map((member) => {
      // Use observation-level interpretation set during data loading
      const interpretation = member.interpretation || 'NORMAL';
      return {
        id: member.id,
        key: member.id,
        name: member.name,
        range: member.meta?.range || '--',
        interpretation,
        value: {
          value: member.value,
          interpretation,
        },
      };
    });
  }
}

function useOverviewData(patientUuid: string) {
  const { sortedObs, loaded, error } = usePatientResultsData(patientUuid);
  const { rangeResultConcepts } = useConfig<ConfigObject>();
  const [overviewData, setOverviewData] = useState<Array<OverviewPanelEntry>>([]);

  useEffect(() => {
    setOverviewData(
      Object.entries(sortedObs)
        .map(([panelName, { entries, type, uuid }]): OverviewPanelEntry => {
          const newestEntry = entries[0];

          return [
            panelName,
            type,
            parseSingleEntry(newestEntry, type, panelName, rangeResultConcepts),
            new Date(newestEntry.effectiveDateTime),
            new Date(newestEntry.issued),
            uuid,
          ];
        })
        .sort(([, , , date1], [, , , date2]) => date2.getTime() - date1.getTime()),
    );
  }, [sortedObs, rangeResultConcepts]);

  return { overviewData, loaded, error };
}

export default useOverviewData;
