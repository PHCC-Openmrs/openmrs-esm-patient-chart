import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import useSWRImmutable from 'swr/immutable';
import {
  attachmentUrl,
  createAttachment,
  type FetchResponse,
  type OpenmrsResource,
  openmrsFetch,
  restBaseUrl,
  useConfig,
} from '@openmrs/esm-framework';
import { type ConfigObject } from '../config-schema';
import type { ConceptAnswer, NursingEncounter, NursingObs, NursingRecord, ScalarNursingField } from './types';

// `value` is deliberately left unqualified: REST then returns a plain string/number for
// text and numeric obs and a `{uuid, display}` object for coded ones, which is what
// getObsDisplayValue / getObsCodedUuid below expect.
const encounterRepresentation = 'custom:(uuid,encounterDatetime,obs:(uuid,concept:(uuid,display),value))';

/**
 * The single SWR key every nursing widget reads from. All three widgets (Dressing,
 * Other Measures and Nursing Procedures) render different columns of the same
 * encounter list, so they share one request -- and one cache entry to invalidate
 * after a save or a delete.
 */
export function getNursingEncountersKey(patientUuid: string, encounterTypeUuid: string): string | null {
  return patientUuid && encounterTypeUuid
    ? `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}&v=${encounterRepresentation}`
    : null;
}

/**
 * Obs values come back either as a plain string/number (text and numeric concepts) or as
 * `{uuid, display}` (coded concepts), depending on the concept's datatype.
 */
function getObsDisplayValue(obs: NursingObs): string {
  return typeof obs.value === 'object' && obs.value !== null ? obs.value.display : String(obs.value ?? '');
}

function getObsCodedUuid(obs: NursingObs): string | undefined {
  return typeof obs.value === 'object' && obs.value !== null ? obs.value.uuid : undefined;
}

/**
 * Maps concept uuids back to the field names used by the form and the widgets. Built from
 * config so that re-pointing a field at a different concept needs no code change.
 */
function buildConceptToFieldMap(concepts: ConfigObject['concepts']): Map<string, ScalarNursingField> {
  const fieldNameSuffix = 'Uuid';
  return new Map(
    Object.entries(concepts)
      .filter(([, conceptUuid]) => Boolean(conceptUuid))
      .map(([key, conceptUuid]) => [conceptUuid, key.replace(new RegExp(`${fieldNameSuffix}$`), '')] as const)
      .filter(([, field]) => field !== 'ointment') as Array<[string, ScalarNursingField]>,
  );
}

function toNursingRecord(
  encounter: NursingEncounter,
  concepts: ConfigObject['concepts'],
  conceptToField: Map<string, ScalarNursingField>,
): NursingRecord {
  const record: NursingRecord = {
    id: encounter.uuid,
    date: encounter.encounterDatetime,
    ointments: [],
  };

  for (const obs of encounter.obs ?? []) {
    if (obs.concept?.uuid === concepts.ointmentUuid) {
      // Ointment is a multi-select, so it arrives as one coded obs per selected answer.
      record.ointments.push(getObsDisplayValue(obs));
      continue;
    }

    const field = conceptToField.get(obs.concept?.uuid);
    if (!field) {
      continue;
    }

    if (field === 'spirometry' || field === 'monofilament') {
      record[field] = Number(getObsDisplayValue(obs));
    } else {
      record[field] = getObsDisplayValue(obs);
    }
  }

  return record;
}

/**
 * Hook returning every nursing encounter for a patient, newest first, flattened into
 * {@link NursingRecord}s.
 */
export function useNursingRecords(patientUuid: string) {
  const { concepts, nursing } = useConfig<ConfigObject>();
  const url = getNursingEncountersKey(patientUuid, nursing.encounterTypeUuid);

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    FetchResponse<{ results: Array<NursingEncounter> }>,
    Error
  >(url, openmrsFetch);

  const conceptToField = useMemo(() => buildConceptToFieldMap(concepts), [concepts]);

  const records = useMemo(() => {
    const results = data?.data?.results;
    if (!results) {
      return undefined;
    }

    return results
      .slice()
      .sort((a, b) => new Date(b.encounterDatetime).getTime() - new Date(a.encounterDatetime).getTime())
      .map((encounter) => toNursingRecord(encounter, concepts, conceptToField));
  }, [data, concepts, conceptToField]);

  return { records, error, isLoading, isValidating, mutate };
}

/**
 * Returns a callback that invalidates the shared nursing encounter list, so all three
 * widgets refresh after the form saves or a record is deleted.
 */
export function useInvalidateNursingRecords(patientUuid: string) {
  const { nursing } = useConfig<ConfigObject>();
  const { mutate } = useSWRConfig();
  const key = getNursingEncountersKey(patientUuid, nursing.encounterTypeUuid);

  return useCallback(() => {
    if (key) {
      return mutate(key);
    }
  }, [key, mutate]);
}

/**
 * The Ointment options come from the answers configured on the Ointment concept rather than
 * from frontend config, so the list can be curated in the dictionary by implementers.
 */
export function useOintmentAnswers() {
  const { concepts } = useConfig<ConfigObject>();
  const url = concepts.ointmentUuid
    ? `${restBaseUrl}/concept/${concepts.ointmentUuid}?v=custom:(uuid,display,answers:(uuid,display))`
    : null;

  const { data, error, isLoading } = useSWRImmutable<
    FetchResponse<{ uuid: string; display: string; answers: Array<ConceptAnswer> }>,
    Error
  >(url, openmrsFetch);

  return {
    answers: data?.data?.answers ?? [],
    error,
    isLoading,
  };
}

/**
 * Hook that loads a single nursing encounter so the form can be pre-filled when editing,
 * and can void the obs it replaces.
 */
export function useNursingEncounter(encounterUuid: string | null) {
  const { concepts } = useConfig<ConfigObject>();
  const url = encounterUuid ? `${restBaseUrl}/encounter/${encounterUuid}?v=${encounterRepresentation}` : null;

  const { data, error, isLoading, mutate } = useSWRImmutable<FetchResponse<NursingEncounter>, Error>(url, openmrsFetch);

  const conceptToField = useMemo(() => buildConceptToFieldMap(concepts), [concepts]);

  /** The obs backing each scalar field, so an edit can void the obs it supersedes. */
  const existingObsByField = useMemo(() => {
    if (!data?.data) {
      return null;
    }

    const byField = new Map<ScalarNursingField, NursingObs>();
    for (const obs of data.data.obs ?? []) {
      const field = conceptToField.get(obs.concept?.uuid);
      if (field) {
        byField.set(field, obs);
      }
    }
    return byField;
  }, [data, conceptToField]);

  /** Every ointment obs on the encounter -- all of them get voided when the selection changes. */
  const existingOintmentObs = useMemo(
    () => (data?.data?.obs ?? []).filter((obs) => obs.concept?.uuid === concepts.ointmentUuid),
    [data, concepts.ointmentUuid],
  );

  const getInitialValues = useCallback(() => {
    const initialValues: Record<string, string | number | Array<string>> = {};
    if (!data?.data) {
      return initialValues;
    }

    existingObsByField?.forEach((obs, field) => {
      const value = getObsDisplayValue(obs);
      initialValues[field] = field === 'spirometry' || field === 'monofilament' ? Number(value) : value;
    });
    initialValues.ointments = existingOintmentObs.map((obs) => getObsCodedUuid(obs)).filter(Boolean);

    return initialValues;
  }, [data, existingObsByField, existingOintmentObs]);

  return {
    encounter: data?.data,
    existingObsByField,
    existingOintmentObs,
    getInitialValues,
    error,
    isLoading,
    mutate,
  };
}

export function createOrUpdateNursingEncounter(
  patientUuid: string,
  encounterTypeUuid: string,
  encounterUuid: string | null,
  location: string,
  obs: Array<OpenmrsResource>,
  abortController: AbortController,
) {
  const url = encounterUuid ? `${restBaseUrl}/encounter/${encounterUuid}` : `${restBaseUrl}/encounter`;

  const encounter: Record<string, unknown> = {
    patient: patientUuid,
    obs,
  };

  if (!encounterUuid) {
    encounter.location = location;
    encounter.encounterType = encounterTypeUuid;
  }

  return openmrsFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: abortController.signal,
    body: encounter,
  });
}

export function deleteNursingEncounter(encounterUuid: string) {
  return openmrsFetch(`${restBaseUrl}/encounter/${encounterUuid}`, {
    method: 'DELETE',
  });
}

/**
 * Uploads the ECG file as a patient attachment and returns its uuid, which the caller
 * stores as the ECG Image obs so the file can be traced back to this encounter.
 */
export async function uploadEcgAttachment(patientUuid: string, file: File, fileCaption: string): Promise<string> {
  const response = await createAttachment(patientUuid, {
    file,
    fileName: file.name,
    fileDescription: fileCaption,
    fileType: file.type,
    // Unused when a File is supplied, but required by the UploadedFile contract.
    base64Content: '',
  });

  const attachmentUuid = response?.data?.uuid;
  if (!attachmentUuid) {
    throw new Error('The attachment service did not return a uuid for the uploaded ECG file');
  }

  return attachmentUuid;
}

/** The URL the raw bytes of an uploaded ECG attachment can be viewed at. */
export function getEcgAttachmentSrc(attachmentUuid: string): string {
  return `${window.openmrsBase}${attachmentUrl}/${attachmentUuid}/bytes`;
}
