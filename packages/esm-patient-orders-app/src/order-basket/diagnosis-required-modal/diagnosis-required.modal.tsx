import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import styles from './diagnosis-required.scss';

interface DiagnosisRequiredModalProps {
  closeModal: () => void;
}

/**
 * Shown when "Sign and close" is clicked in the order basket for a patient with no active
 * diagnosis. The orders stay in the basket, unsubmitted.
 */
const DiagnosisRequiredModal: React.FC<DiagnosisRequiredModalProps> = ({ closeModal }) => {
  const { t } = useTranslation();

  return (
    <div>
      <ModalHeader closeModal={closeModal} title={t('diagnosisRequired', 'Diagnosis required')} />
      <ModalBody>
        <p className={styles.bodyShort02}>
          {t(
            'addDiagnosisBeforeOrdering',
            'This patient has no active diagnosis. Please add a diagnosis first, then sign the orders.',
          )}
        </p>
      </ModalBody>
      <ModalFooter>
        <Button kind="primary" onClick={closeModal}>
          {t('ok', 'OK')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default DiagnosisRequiredModal;
