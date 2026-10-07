import { useMemo } from 'react';
import useSWR from 'swr';
import { openmrsFetch, restBaseUrl, type FetchResponse, type OpenmrsResource } from '@openmrs/esm-framework';
import { type Order } from '@openmrs/esm-patient-common-lib';
import { type Encounter, type Observation } from '../types/encounter';
import { type OrderDiscontinuationPayload } from '../types/order';

const labEncounterRepresentation =
  'custom:(uuid,encounterDatetime,encounterType:(uuid,display),location:(uuid,name),patient:(uuid,display,person:(uuid,display,gender,age)),encounterProviders:(uuid,provider:(uuid,name)),obs:(uuid,obsDatetime,voided,groupMembers:(uuid,concept:(uuid,name:(uuid,name)),value:(uuid,display,name:(uuid,name),names:(uuid,conceptNameType,name)),interpretation,groupMembers:(uuid,concept:(uuid,name:(uuid,name)),value:(uuid,display,name:(uuid,name),names:(uuid,conceptNameType,name)),interpretation)),formFieldNamespace,formFieldPath,order:(uuid,display),concept:(uuid,name:(uuid,name)),value:(uuid,display,name:(uuid,name),names:(uuid,conceptNameType,name)),interpretation))';
const labConceptRepresentation =
  'custom:(uuid,display,name,datatype,set,answers,hiNormal,hiAbsolute,hiCritical,lowNormal,lowAbsolute,lowCritical,units,allowDecimal,' +
  'setMembers:(uuid,display,answers,datatype,hiNormal,hiAbsolute,hiCritical,lowNormal,lowAbsolute,lowCritical,units,allowDecimal,set,setMembers:(uuid)))';
const obsMemberRepresentation = 'uuid,display,concept:(uuid,display),value';
// Panels can be nested (e.g. Urine Analysis -> physical/chemical/microscopic sub-panels -> tests), so fetch two levels of group members.
const conceptObsRepresentation = `custom:(uuid,display,concept:(uuid,display),value,groupMembers:(${obsMemberRepresentation},groupMembers:(${obsMemberRepresentation})))`;

type NullableNumber = number | null | undefined;
export interface LabOrderConcept {
  uuid: string;
  display: string;
  name?: ConceptName;
  datatype: Datatype;
  set: boolean;
  version: string;
  retired: boolean;
  descriptions: Array<Description>;
  mappings?: Array<Mapping>;
  answers?: Array<OpenmrsResource>;
  setMembers?: Array<LabOrderConcept>;
  hiNormal?: NullableNumber;
  hiAbsolute?: NullableNumber;
  hiCritical?: NullableNumber;
  lowNormal?: NullableNumber;
  lowAbsolute?: NullableNumber;
  lowCritical?: NullableNumber;
  allowDecimal?: boolean | null;
  units?: string;
}

export interface ConceptName {
  display: string;
  uuid: string;
  name: string;
  locale: string;
  localePreferred: boolean;
  conceptNameType: string;
}

export interface Datatype {
  uuid: string;
  display: string;
  name: string;
  description: string;
  hl7Abbreviation: string;
  retired: boolean;
  resourceVersion: string;
}

export interface Description {
  display: string;
  uuid: string;
  description: string;
  locale: string;
  resourceVersion: string;
}

export interface Mapping {
  display: string;
  uuid: string;
  conceptReferenceTerm: OpenmrsResource;
  conceptMapType: OpenmrsResource;
  resourceVersion: string;
}

function getUrlForConcept(conceptUuid: string) {
  return `${restBaseUrl}/concept/${conceptUuid}?v=${labConceptRepresentation}`;
}

/**
 * This function fetches all the different levels of set members for a concept,
 * while fetching 2 levels of set members at one go.
 * @param conceptUuid - The UUID of the concept to fetch.
 * @returns The concept with all its set members and their set members.
 */
async function fetchAllSetMembers(conceptUuid: string): Promise<LabOrderConcept> {
  const conceptResponse = await openmrsFetch<LabOrderConcept>(getUrlForConcept(conceptUuid));
  let concept = conceptResponse.data;
  const secondLevelSetMembers = concept.set
    ? concept.setMembers
        .map((member) => (member.set ? member.setMembers.map((lowerMember) => lowerMember.uuid) : []))
        .flat()
    : [];
  if (secondLevelSetMembers.length > 0) {
    const concepts = await Promise.all(secondLevelSetMembers.map((uuid) => fetchAllSetMembers(uuid)));
    const uuidMap = concepts.reduce(
      (acc, c) => {
        acc[c.uuid] = c;
        return acc;
      },
      {} as Record<string, LabOrderConcept>,
    );
    concept.setMembers = concept.setMembers.map((member) => {
      if (member.set) {
        member.setMembers = member.setMembers.map((lowerMember) => uuidMap[lowerMember.uuid]);
      }
      return member;
    });
  }

  return concept;
}

export function useOrderConceptByUuid(uuid: string) {
  const apiUrl = `${restBaseUrl}/concept/${uuid}?v=${labConceptRepresentation}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<LabOrderConcept, Error>(uuid, fetchAllSetMembers);
  /**
   * We are fetching 2 levels of set members at one go.
   */

  const results = useMemo(
    () => ({
      concept: data,
      isLoading,
      error,
      isValidating,
      mutate,
    }),
    [data, error, isLoading, isValidating, mutate],
  );

  return results;
}

export function useOrderConceptsByUuids(uuids: Array<string>) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<Array<LabOrderConcept>, Error>(
    uuids.length ? ['concepts', ...uuids] : null,
    () => Promise.all(uuids.map((uuid) => fetchAllSetMembers(uuid))),
  );

  const results = useMemo(
    () => ({
      concepts: data ?? [],
      isLoading,
      error,
      isValidating,
      mutate,
    }),
    [data, error, isLoading, isValidating, mutate],
  );

  return results;
}

export function useLabEncounter(encounterUuid: string | undefined) {
  const apiUrl = `${restBaseUrl}/encounter/${encounterUuid}?v=${labEncounterRepresentation}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<FetchResponse<Encounter>, Error>(
    encounterUuid ? apiUrl : null,
    openmrsFetch,
  );

  return {
    encounter: data?.data,
    isLoading,
    error: error,
    isValidating,
    mutate,
  };
}

export function useObservation(obsUuid: string) {
  const url = `${restBaseUrl}/obs/${obsUuid}?v=${conceptObsRepresentation}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: Observation }, Error>(
    obsUuid ? url : null,
    openmrsFetch,
  );
  return {
    data: data?.data,
    isLoading,
    error,
    isValidating,
    mutate,
  };
}

export function useObservations(obsUuids: Array<string>) {
  const fetchMultipleObservations = async (): Promise<Array<Observation>> => {
    const results = await Promise.all(
      obsUuids.map(async (uuid) => {
        const url = `${restBaseUrl}/obs/${uuid}?v=${conceptObsRepresentation}`;
        const res = await openmrsFetch(url);
        return res.data;
      }),
    );

    return results;
  };

  const { data, error, isLoading, isValidating, mutate } = useSWR<Observation[], Error>(
    obsUuids && obsUuids.length > 0 ? ['observations', ...obsUuids] : null,
    fetchMultipleObservations,
  );

  return {
    data: data ?? [],
    isLoading,
    error,
    isValidating,
    mutate,
  };
}

export function useCompletedLabResults(order: Order) {
  const {
    encounter,
    isLoading: isLoadingEncounter,
    mutate: mutateLabOrders,
    error: encounterError,
  } = useLabEncounter(order.encounter?.uuid);
  const {
    data: observation,
    isLoading: isLoadingObs,
    error: isErrorObs,
    mutate: mutateObs,
  } = useObservation(encounter?.obs.find((obs) => obs?.concept?.uuid === order?.concept?.uuid)?.uuid ?? '');

  return {
    isLoading: isLoadingEncounter || isLoadingObs,
    completeLabResult: observation,
    mutate: () => {
      mutateLabOrders();
      mutateObs();
    },
    error: isErrorObs ?? encounterError,
  };
}

export function useCompletedLabResultsArray(order: Order) {
  const {
    encounter,
    isLoading: isLoadingEncounter,
    mutate: mutateLabOrders,
    error: encounterError,
  } = useLabEncounter(order.encounter?.uuid);

  const obsUuids = encounter?.obs.filter((o) => o?.order.uuid === order?.uuid).map((o) => o.uuid);

  const { data: observations, isLoading: isLoadingObs, error: errorObs, mutate: mutateObs } = useObservations(obsUuids);

  return {
    isLoading: isLoadingEncounter || isLoadingObs,
    completeLabResults: observations,
    mutate: () => {
      mutateLabOrders();
      mutateObs();
    },
    error: errorObs ?? encounterError,
  };
}

// TODO: the calls to update order and observations for results should be transactional to allow for rollback
export async function updateOrderResult(
  orderUuid: string,
  encounterUuid: string,
  obsPayload: any,
  fulfillerPayload: any,
  orderPayload: OrderDiscontinuationPayload,
  abortController: AbortController,
) {
  const saveEncounter = await openmrsFetch(`${restBaseUrl}/encounter/${encounterUuid}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: obsPayload,
  });

  if (saveEncounter.ok) {
    const updateOrderCall = await openmrsFetch(`${restBaseUrl}/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: abortController.signal,
      body: orderPayload,
    });

    if (updateOrderCall.status === 201) {
      const fulfillOrder = await openmrsFetch(`${restBaseUrl}/order/${orderUuid}/fulfillerdetails/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortController.signal,
        body: fulfillerPayload,
      });
      return fulfillOrder;
    }
  }
  throw new Error('Failed to update order');
}

/**
 * Builds the observation for a concept, recursing through nested panels so that tests inside
 * sub-panels are saved as group members of their own sub-panel obs. Returns null when nothing
 * in the concept (or any of its descendants) has a value.
 */
function createNestedObservation(
  concept: LabOrderConcept,
  order: Order,
  values: Record<string, unknown>,
  status: string,
): ReturnType<typeof createObservationByConcept> | null {
  if (isPanel(concept)) {
    const groupMembers = concept.setMembers
      .map((member) => createNestedObservation(member, order, values, status))
      .filter((member) => member !== null);
    return groupMembers.length > 0 ? createObservationByConcept(concept, order, groupMembers, null, status) : null;
  }

  const value = getValue(concept, values);
  return value === null || value === undefined ? null : createObservationByConcept(concept, order, null, value, status);
}

export function createObservationPayload(
  concept: LabOrderConcept,
  order: Order,
  values: Record<string, unknown>,
  status: string,
) {
  const observation = createNestedObservation(concept, order, values, status);
  return { obs: observation ? [observation] : [] };
}

export function createCompositeObservationPayload(
  concepts: LabOrderConcept[],
  order: Order,
  values: Record<string, unknown>,
  status: string,
) {
  if (!concepts || concepts.length === 0) return { obs: [] };

  return {
    obs: concepts
      .map((concept) => createNestedObservation(concept, order, values, status))
      .filter((observation) => observation !== null),
  };
}

/**
 * Finds the observation for a concept anywhere in an observation tree, however deeply it is nested.
 */
export function findObservationByConcept(
  observations: Array<Observation> | undefined,
  conceptUuid: string,
): Observation | undefined {
  for (const observation of observations ?? []) {
    if (observation?.concept?.uuid === conceptUuid) {
      return observation;
    }
    const nested = findObservationByConcept(observation?.groupMembers, conceptUuid);
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

export interface ObservationSaveTask {
  conceptUuid: string;
  save: () => Promise<unknown>;
}

/**
 * True when a field that now has a value has no saved observation yet (e.g. a sub-panel that was
 * skipped the first time results were entered).
 */
function hasUnsavedValues(
  concept: LabOrderConcept,
  existing: Observation | undefined,
  values: Record<string, unknown>,
): boolean {
  if (isPanel(concept)) {
    return concept.setMembers.some((member) =>
      hasUnsavedValues(
        member,
        existing?.groupMembers?.find((groupMember) => groupMember.concept?.uuid === member.uuid),
        values,
      ),
    );
  }
  const value = values[concept.uuid];
  return !existing && value !== undefined && value !== null && value !== '';
}

/**
 * Works out what has to be written to save edited results.
 *
 * Existing observations are updated in place. The REST API cannot attach a new observation to an
 * existing group, so when a filled field has no observation yet, the whole result is saved again
 * as a new observation tree and the previous one is voided once the new one is stored.
 */
export function createObservationSaveTasks(
  concepts: Array<LabOrderConcept>,
  existingObservations: Array<Observation>,
  order: Order,
  values: Record<string, unknown>,
): Array<ObservationSaveTask> {
  const tasks: Array<ObservationSaveTask> = [];

  const updateExisting = (concept: LabOrderConcept, existing: Observation) => {
    if (isPanel(concept)) {
      concept.setMembers.forEach((member) => {
        const memberObs = existing.groupMembers?.find((groupMember) => groupMember.concept?.uuid === member.uuid);
        if (memberObs) {
          updateExisting(member, memberObs);
        }
      });
      return;
    }

    const value = values[concept.uuid];
    if (value !== undefined && value !== null && value !== '') {
      tasks.push({ conceptUuid: concept.uuid, save: () => updateObservation(existing.uuid, { value }) });
    }
  };

  concepts.forEach((concept) => {
    const existing = existingObservations.find((observation) => observation.concept?.uuid === concept.uuid);
    if (!existing || hasUnsavedValues(concept, existing, values)) {
      const observation = createNestedObservation(concept, order, values, 'FINAL');
      if (observation) {
        tasks.push({
          conceptUuid: concept.uuid,
          save: async () => {
            await saveNewObservations(order.encounter.uuid, [observation]);
            if (existing) {
              await voidObservation(existing.uuid);
            }
          },
        });
      }
      return;
    }

    updateExisting(concept, existing);
  });

  return tasks;
}

function saveNewObservations(encounterUuid: string, obs: Array<unknown>) {
  return openmrsFetch(`${restBaseUrl}/encounter/${encounterUuid}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ obs }),
  });
}

function voidObservation(observationUuid: string) {
  return openmrsFetch(`${restBaseUrl}/obs/${observationUuid}`, { method: 'DELETE' });
}

export function updateObservation(observationUuid: string, payload: Record<string, any>) {
  return openmrsFetch(`${restBaseUrl}/obs/${observationUuid}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

function createObservationByConcept(
  concept: LabOrderConcept,
  order: Order,
  groupMembers = null,
  value = null,
  status: string,
) {
  return {
    concept: { uuid: concept.uuid },
    status: status,
    order: { uuid: order.uuid },
    ...(groupMembers && groupMembers.length > 0 && { groupMembers }),
    ...(value !== null && value !== undefined && { value }),
  };
}

function getValue(concept: LabOrderConcept, values: Record<string, unknown>) {
  const { datatype, uuid } = concept;
  const value = values[uuid];

  if (value === null || value === undefined) {
    return null;
  }

  // hl7Abbreviation is NM for Numeric and ST for Text
  if (['NM', 'ST'].includes(datatype.hl7Abbreviation)) {
    return value;
  }
  // hl7Abbreviation is CWE for Coded with exceptions datatype
  if (datatype.hl7Abbreviation === 'CWE') {
    return { uuid: value };
  }

  return null;
}

export interface PanelResultRow {
  concept: LabOrderConcept;
  /** The saved observation for this concept, if one exists. */
  obs: Observation | undefined;
  /** True for a sub-panel heading, whose tests follow it in the list. */
  isHeading: boolean;
}

/**
 * Flattens a panel into display rows in order. Sub-panels (e.g. "Urine physical examination"
 * inside "Urine Analysis") produce a heading row followed by their own tests, so results from
 * nested panels are shown instead of being skipped.
 */
export function flattenPanelResults(concept: LabOrderConcept, obs: Observation | undefined): Array<PanelResultRow> {
  return (concept.setMembers ?? []).flatMap((member) => {
    const memberObs = obs?.groupMembers?.find((groupMember) => groupMember.concept?.uuid === member.uuid);
    return isPanel(member)
      ? [{ concept: member, obs: memberObs, isHeading: true }, ...flattenPanelResults(member, memberObs)]
      : [{ concept: member, obs: memberObs, isHeading: false }];
  });
}

export const isCoded = (concept: LabOrderConcept) => concept.datatype?.display === 'Coded';
export const isNumeric = (concept: LabOrderConcept) => concept.datatype?.display === 'Numeric';
export const isPanel = (concept: LabOrderConcept) => concept.setMembers?.length > 0;
export const isText = (concept: LabOrderConcept) => concept.datatype?.display === 'Text';
