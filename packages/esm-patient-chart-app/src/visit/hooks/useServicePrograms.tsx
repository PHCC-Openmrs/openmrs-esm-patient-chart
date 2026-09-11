import useSWR from 'swr';
import { type FetchResponse, openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { filterProgramsByLocation, type ProgramLocationRestriction } from '@openmrs/esm-patient-common-lib';

export interface ServiceProgram {
  uuid: string;
  display: string;
  name: string;
}

/**
 * The list of services (programs) selectable in the start-visit form's Service field, filtered
 * by the visit location chosen in the form -- reusing the same `programsLocationRestrictions`
 * config and `filterProgramsByLocation` helper that esm-patient-programs-app's "Add service"
 * form applies against the session location, so a service is offered on the same terms in both
 * places.
 */
export function useServicePrograms(visitLocationUuid: string | undefined) {
  const { data, error, isLoading } = useSWR<FetchResponse<{ results: Array<ServiceProgram> }>, Error>(
    `${restBaseUrl}/program?v=custom:(uuid,display,name)`,
    openmrsFetch,
  );

  // esm-patient-programs-app owns the location-restriction config; read it as an external
  // module rather than duplicating it here, so both apps stay in sync from one source.
  const { programsLocationRestrictions } = useConfig<{
    programsLocationRestrictions: Array<ProgramLocationRestriction>;
  }>({ externalModuleName: '@openmrs/esm-patient-programs-app' });

  const allPrograms = data?.data?.results ?? [];
  const servicePrograms = filterProgramsByLocation(allPrograms, programsLocationRestrictions, visitLocationUuid);

  return {
    servicePrograms: servicePrograms ?? [],
    isLoading,
    error,
  };
}
