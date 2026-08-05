import useSWR from 'swr';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

export interface ProgramSectionObservation {
  uuid: string;
  concept: { uuid: string; display: string };
  value: string | number | { uuid: string; display: string };
}

export interface ProgramSectionEncounter {
  uuid: string;
  encounterDatetime: string;
  obs: Array<ProgramSectionObservation>;
}

const encounterCustomRepresentation = 'custom:(uuid,encounterDatetime,obs:(uuid,concept:(uuid,display),value))';

export function useProgramSectionEncounters(patientUuid: string, encounterTypeUuid: string) {
  const url =
    patientUuid && encounterTypeUuid
      ? `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}&v=${encounterCustomRepresentation}`
      : null;

  const { data, error, isLoading, mutate } = useSWR<{ data: { results: Array<ProgramSectionEncounter> } }, Error>(
    url,
    openmrsFetch,
  );

  const encounters = (data?.data?.results ?? [])
    .slice()
    .sort((a, b) => (a.encounterDatetime > b.encounterDatetime ? -1 : 1));

  return {
    encounters,
    latestEncounter: encounters[0],
    error,
    isLoading,
    mutateEncounters: mutate,
  };
}

export function saveProgramSectionEncounter(
  patientUuid: string,
  locationUuid: string,
  encounterTypeUuid: string,
  valuesByConceptUuid: Record<string, string>,
  abortController: AbortController,
) {
  const obs = Object.entries(valuesByConceptUuid)
    .filter(([, value]) => value != null && value !== '')
    .map(([concept, value]) => ({ concept, value }));

  return openmrsFetch(`${restBaseUrl}/encounter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      encounterType: encounterTypeUuid,
      patient: patientUuid,
      location: locationUuid,
      obs,
    },
    signal: abortController.signal,
  });
}

export function findObsValue(encounter: ProgramSectionEncounter | undefined, conceptUuid: string): string {
  const obs = encounter?.obs?.find((o) => o.concept.uuid === conceptUuid);
  if (!obs) {
    return '--';
  }
  return typeof obs.value === 'object' ? obs.value.display : String(obs.value);
}

export function usePatientAge(patientUuid: string) {
  const url = patientUuid ? `${restBaseUrl}/patient/${patientUuid}?v=custom:(person:(age))` : null;
  const { data, isLoading } = useSWR<{ data: { person: { age: number } } }, Error>(url, openmrsFetch);
  return { age: data?.data?.person?.age, isLoading };
}

// Malnutrition Categories by MUAC (6-59 months): SAM < 11.5cm, MAM 11.5-<12.5cm, Normal >= 12.5cm.
function muacNutritionCategory(muacValue: string): string {
  const muac = Number(muacValue);
  if (!muacValue || Number.isNaN(muac)) {
    return '';
  }
  if (muac < 11.5) {
    return 'Severe Acute Malnutrition (SAM)';
  }
  if (muac < 12.5) {
    return 'Moderate Acute Malnutrition (MAM)';
  }
  return 'Normal Nutritional Status';
}

const AUTOFILL_RULES: Record<string, (sourceValue: string) => string> = {
  muacNutritionCategory,
};

export function computeAutofillValue(autofillRule: string, sourceValue: string): string {
  return AUTOFILL_RULES[autofillRule]?.(sourceValue) ?? '';
}
