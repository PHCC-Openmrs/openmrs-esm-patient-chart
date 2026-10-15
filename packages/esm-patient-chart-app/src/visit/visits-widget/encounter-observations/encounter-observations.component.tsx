import React from 'react';
import { useTranslation } from 'react-i18next';
import { SkeletonText } from '@carbon/react';
import { type Obs, useConfig } from '@openmrs/esm-framework';
import { formatRangeResult } from '@openmrs/esm-patient-common-lib';
import { type ChartConfig } from '../../../config-schema';
import styles from './styles.scss';

interface EncounterObservationsProps {
  observations: Array<Obs>;
}

const EncounterObservations: React.FC<EncounterObservationsProps> = ({ observations }) => {
  const { t } = useTranslation();
  const { obsConceptUuidsToHide = [], rangeResultConcepts = [] } = useConfig<ChartConfig>();

  function getAnswerFromDisplay(display: string): string {
    const colonIndex = display.indexOf(':');
    if (colonIndex === -1) {
      return '';
    } else {
      return display.substring(colonIndex + 1).trim();
    }
  }

  // A range test's members are its Lower and Upper bounds, in that order; show them as one "100 – 120 mg/dL" answer
  function getRangeAnswer([lower, upper]: Array<Obs>): string {
    const getBound = (bound: Obs) =>
      typeof bound?.value === 'number' ? bound.value : getAnswerFromDisplay(bound?.display ?? '');
    return formatRangeResult(getBound(lower), getBound(upper), lower?.concept?.units ?? upper?.concept?.units);
  }

  const filteredObservations = !!obsConceptUuidsToHide.length
    ? observations?.filter((obs) => {
        return !obsConceptUuidsToHide.includes(obs?.concept?.uuid);
      })
    : observations;

  if (!filteredObservations || filteredObservations.length == 0) {
    return (
      <div className={styles.observation}>
        <p>{t('noObservationsFound', 'No observations found')}</p>
      </div>
    );
  }

  return (
    <div className={styles.observation}>
      {filteredObservations?.map((obs, index) => {
        if (rangeResultConcepts.includes(obs.concept?.uuid) && obs.groupMembers?.length === 2) {
          return (
            <React.Fragment key={index}>
              <span>{obs.concept.display}</span>
              <span>{getRangeAnswer(obs.groupMembers)}</span>
            </React.Fragment>
          );
        } else if (obs.groupMembers) {
          return (
            <React.Fragment key={index}>
              <span className={styles.parentConcept}>{obs.concept.display}</span>
              <span />
              {obs.groupMembers.map((member) => (
                <React.Fragment key={index}>
                  <span className={styles.childConcept}>{member.concept.display}</span>
                  <span>{getAnswerFromDisplay(member.display)}</span>
                </React.Fragment>
              ))}
            </React.Fragment>
          );
        } else {
          return (
            <React.Fragment key={index}>
              <span>{obs.concept.display}</span>
              <span>{getAnswerFromDisplay(obs.display)}</span>
            </React.Fragment>
          );
        }
      })}
    </div>
  );
};

export default EncounterObservations;
