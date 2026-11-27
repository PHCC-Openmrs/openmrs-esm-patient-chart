import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { showSnackbar, updateVisit, useVisit } from '@openmrs/esm-framework';
import { usePatientChartStore, useVisitEndPermission } from '@openmrs/esm-patient-common-lib';
import styles from './end-visit-dialog.scss';

interface EndVisitDialogProps {
  patientUuid: string;
  closeModal: () => void;
}

/**
 * This modal shows up when user clicks on the "End visit" button in the action menu within the
 * patient banner. It should only show when the patient has an active visit. See stop-visit.component.tsx
 * for the button.
 *
 * This dialog uses the patient chart store and SHOULD only be mounted within the patient chart
 *
 * A visit can only be ended from the location it was started at (see useVisitEndPermission); from
 * anywhere else the dialog says where to log in instead of offering to end it. The server enforces the
 * same rule.
 */
const EndVisitDialog: React.FC<EndVisitDialogProps> = ({ patientUuid, closeModal }) => {
  const { t } = useTranslation();
  const { activeVisit, mutate } = useVisit(patientUuid);
  const { visitContext, setVisitContext } = usePatientChartStore(patientUuid);
  const { canEndVisit, visitLocationName } = useVisitEndPermission(activeVisit);

  const handleEndVisit = () => {
    if (activeVisit && canEndVisit) {
      const endVisitPayload = {
        stopDatetime: new Date(),
      };

      const abortController = new AbortController();

      updateVisit(activeVisit.uuid, endVisitPayload, abortController)
        .then((response) => {
          mutate();
          window.dispatchEvent(new CustomEvent('queue-entry-updated'));
          window.dispatchEvent(
            new CustomEvent('visit-ended', { detail: { patientUuid, visitUuid: activeVisit.uuid } }),
          );
          closeModal();
          if (visitContext?.uuid == activeVisit.uuid) {
            setVisitContext(null, null);
          }
          showSnackbar({
            isLowContrast: true,
            kind: 'success',
            subtitle: t('visitEndSuccessfully', `${response?.data?.visitType?.display} ended successfully`),
            title: t('visitEnded', 'Visit ended'),
          });
        })
        .catch((error) => {
          showSnackbar({
            title: t('errorEndingVisit', 'Error ending visit'),
            kind: 'error',
            isLowContrast: false,
            // The server's own reason (e.g. the visit-location rule) is more useful than the HTTP summary.
            subtitle: error?.responseBody?.error?.message ?? error?.message,
          });
        });
    }
  };

  if (!canEndVisit) {
    return (
      <div>
        <ModalHeader closeModal={closeModal} title={t('cannotEndVisitHere', 'This visit cannot be ended here')} />
        <ModalBody>
          <p className={styles.bodyShort02}>
            {visitLocationName
              ? t(
                  'visitStartedAtOtherLocation',
                  'This visit was started at {{location}}. Log in at {{location}} to end it.',
                  { location: visitLocationName },
                )
              : t(
                  'visitStartedAtOtherLocationUnnamed',
                  'This visit was started at a different location. Log in at that location to end it.',
                )}
          </p>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={closeModal}>
            {t('close', 'Close')}
          </Button>
        </ModalFooter>
      </div>
    );
  }

  return (
    <div>
      <ModalHeader
        closeModal={closeModal}
        title={t('endActiveVisitConfirmation', 'Are you sure you want to end this active visit?')}
      />
      <ModalBody>
        <p className={styles.bodyShort02}>
          {t('youCanAddAdditionalEncounters', 'You can add additional encounters to this visit in the visit summary.')}
        </p>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button kind="danger" onClick={handleEndVisit}>
          {t('endVisit_title', 'End Visit')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default EndVisitDialog;
