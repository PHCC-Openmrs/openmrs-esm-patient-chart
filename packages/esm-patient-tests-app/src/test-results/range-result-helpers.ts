import { useMemo } from 'react';
import useSWRImmutable from 'swr/immutable';
import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import {
  formatRangeResult,
  isRangeResult,
  type RangeResultConcept,
  worstInterpretation,
} from '@openmrs/esm-patient-common-lib';
import { type ObservationData, type TreeNode } from './filter/filter-types';

const noRangeConcepts: Array<RangeResultConcept> = [];

const rangeConceptRepresentation =
  'custom:(uuid,display,datatype:(display,hl7Abbreviation),setMembers:(uuid,display,datatype:(display,hl7Abbreviation)))';

/**
 * Loads the configured range test concepts (see the `rangeResultConcepts` config) together with their set members,
 * keeping only those that really are ranges. The obstree response does not carry the uuid of a nested set, so a
 * range test nested in a panel can only be recognised by the uuids of its Lower and Upper members.
 */
export function useRangeResultConcepts(rangeResultConcepts: Array<string>) {
  const url = rangeResultConcepts?.length
    ? `${restBaseUrl}/concept?references=${rangeResultConcepts.join(',')}&v=${rangeConceptRepresentation}`
    : null;
  const { data, isLoading } = useSWRImmutable<FetchResponse<{ results: Array<RangeResultConcept> }>, Error>(
    url,
    openmrsFetch,
  );

  const rangeConcepts = useMemo(
    () => data?.data?.results?.filter((concept) => isRangeResult(concept, rangeResultConcepts)) ?? noRangeConcepts,
    [data, rangeResultConcepts],
  );

  return { rangeConcepts, isLoading: Boolean(url) && isLoading };
}

/**
 * Pairs each lower bound obs with the upper bound obs recorded at the same time, i.e. the other member of the same
 * obs group. A bound without a partner is kept on its own so the range can still be shown as "100 – ?".
 */
export function pairRangeObs<T extends { obsDatetime?: string }>(
  lowerObs: Array<T> = [],
  upperObs: Array<T> = [],
): Array<{ lower?: T; upper?: T }> {
  const unpairedUpper = [...upperObs];
  const pairs = lowerObs.map((lower) => {
    const index = unpairedUpper.findIndex((upper) => upper.obsDatetime === lower.obsDatetime);
    return { lower, upper: index === -1 ? undefined : unpairedUpper.splice(index, 1)[0] };
  });
  return [...pairs, ...unpairedUpper.map((upper) => ({ upper }))];
}

/**
 * Collapses the Lower and Upper leaves of a range test into a single leaf for the range test itself. Each obs reads
 * "100 – 120", is flagged with the worse of the two bounds, and carries the lower bound's reference range and units.
 */
export function mergeRangeNodes(
  rangeNode: Pick<TreeNode, 'display' | 'flatName'>,
  conceptUuid: string,
  lower: TreeNode | undefined,
  upper: TreeNode | undefined,
): TreeNode {
  const obs: Array<ObservationData> = pairRangeObs<ObservationData>(lower?.obs, upper?.obs).map(
    ({ lower: low, upper: high }) => ({
      ...low,
      obsDatetime: (low ?? high).obsDatetime,
      value: formatRangeResult(low?.value, high?.value),
      interpretation: worstInterpretation(low?.interpretation, high?.interpretation),
      range: low?.range ?? lower?.range,
    }),
  );

  return {
    display: rangeNode.display,
    flatName: rangeNode.flatName,
    conceptUuid,
    datatype: lower?.datatype ?? upper?.datatype,
    units: lower?.units ?? upper?.units,
    hiAbsolute: lower?.hiAbsolute,
    hiCritical: lower?.hiCritical,
    hiNormal: lower?.hiNormal,
    lowAbsolute: lower?.lowAbsolute,
    lowCritical: lower?.lowCritical,
    lowNormal: lower?.lowNormal,
    range: lower?.range,
    hasData: obs.length > 0,
    isRangeResult: true,
    obs,
  };
}
