import useSWR from 'swr';
import { filter, includes, map } from 'lodash-es';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { createProgramEnrollment, filterProgramsByLocation } from '@openmrs/esm-patient-common-lib';
import type { PatientProgram, Program, ProgramWorkflowState, ProgramsFetchResponse } from '../types';

// Re-exported for existing importers -- the implementations now live in esm-patient-common-lib
// so esm-patient-chart-app's start-visit form can share them (see useServicePrograms.tsx).
export { createProgramEnrollment, filterProgramsByLocation };

export const customRepresentation = `custom:(uuid,display,program,dateEnrolled,dateCompleted,location:(uuid,display),states:(startDate,endDate,voided,state:(uuid,concept:(display))))`;

export function useEnrollments(patientUuid: string) {
  const enrollmentsUrl = `${restBaseUrl}/programenrollment?patient=${patientUuid}&v=${customRepresentation}`;
  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: ProgramsFetchResponse }, Error>(
    patientUuid ? enrollmentsUrl : null,
    openmrsFetch,
  );

  // Every visit now creates its own enroll+complete episode (see the start-visit form's Service
  // field), so a patient can have several enrollments in the same program -- show each one
  // rather than collapsing to the latest, so Care Services reflects full visit history.
  const formattedEnrollments =
    data?.data?.results.length > 0
      ? data?.data.results.sort((a, b) => (b.dateEnrolled > a.dateEnrolled ? 1 : -1))
      : null;

  const activeEnrollments = formattedEnrollments?.filter((enrollment) => !enrollment.dateCompleted);

  return {
    data: data ? formattedEnrollments : null,
    error,
    isLoading,
    isValidating,
    activeEnrollments,
    mutateEnrollments: mutate,
  };
}

export function useAvailablePrograms(enrollments?: Array<PatientProgram>) {
  const { data, error, isLoading } = useSWR<{ data: { results: Array<Program> } }, Error>(
    `${restBaseUrl}/program?v=custom:(uuid,display,allWorkflows,concept:(uuid,display))`,
    openmrsFetch,
  );

  const availablePrograms = data?.data?.results ?? null;

  const eligiblePrograms = filter(
    availablePrograms,
    (program) => !includes(map(enrollments, 'program.uuid'), program.uuid),
  );

  return {
    data: availablePrograms,
    error,
    isLoading,
    eligiblePrograms,
  };
}

export function updateProgramEnrollment(programEnrollmentUuid: string, payload, abortController) {
  if (!payload && !payload.program) {
    return null;
  }
  const { dateEnrolled, dateCompleted, location, states } = payload;
  return openmrsFetch(`${restBaseUrl}/programenrollment/${programEnrollmentUuid}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: { dateEnrolled, dateCompleted, location, states },
    signal: abortController.signal,
  });
}

export function deleteProgramEnrollment(programEnrollmentUuid: string) {
  const abortController = new AbortController();
  return openmrsFetch(`${restBaseUrl}/programenrollment/${programEnrollmentUuid}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
  });
}

export const usePrograms = (patientUuid: string) => {
  const {
    data: enrollments,
    error: enrollError,
    isLoading: enrolLoading,
    isValidating,
    activeEnrollments,
  } = useEnrollments(patientUuid);
  const { data: availablePrograms, eligiblePrograms } = useAvailablePrograms(enrollments);

  const status = { isLoading: enrolLoading, error: enrollError };
  return {
    enrollments,
    ...status,
    isValidating,
    activeEnrollments,
    availablePrograms,
    eligiblePrograms,
  };
};

// A single row in the Care Services table, representing every enrollment the patient has ever
// had in one program collapsed into one line -- since each visit now opens its own enrollment
// episode for a program (see the start-visit form's Service field), a per-episode "Date
// enrolled" column would repeat the same program once per visit. `count` is how many episodes
// (visits) that program has been selected for, and `lastDateEnrolled` is the most recent one --
// i.e. the last time the patient came in for that service.
export interface ProgramEnrollmentGroup {
  uuid: string;
  display: string;
  location?: PatientProgram['location'];
  count: number;
  lastDateEnrolled: string;
  dateCompleted: string | null;
  states?: Array<ProgramWorkflowState>;
}

export function groupEnrollmentsByProgram(
  enrollments: Array<PatientProgram> | null | undefined,
): Array<ProgramEnrollmentGroup> {
  if (!enrollments?.length) {
    return [];
  }

  const episodesByProgramUuid = new Map<string, Array<PatientProgram>>();
  for (const enrollment of enrollments) {
    const key = enrollment.program?.uuid ?? enrollment.uuid;
    const episodes = episodesByProgramUuid.get(key);
    if (episodes) {
      episodes.push(enrollment);
    } else {
      episodesByProgramUuid.set(key, [enrollment]);
    }
  }

  // `enrollments` arrives sorted by dateEnrolled descending (see useEnrollments above), so each
  // program's episodes are already in that order -- the first one is the most recent.
  return [...episodesByProgramUuid.values()].map(([latestEpisode, ...otherEpisodes]) => ({
    uuid: latestEpisode.uuid,
    display: latestEpisode.display,
    location: latestEpisode.location,
    count: otherEpisodes.length + 1,
    lastDateEnrolled: latestEpisode.dateEnrolled,
    dateCompleted: latestEpisode.dateCompleted,
    states: latestEpisode.states,
  }));
}

export const findLastState = (states: ProgramWorkflowState[]): ProgramWorkflowState => {
  const activeStates = states.filter((state) => !state.voided);
  const ongoingState = activeStates.find((state) => !state.endDate);

  if (ongoingState) {
    return ongoingState;
  }

  return activeStates.sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0];
};
