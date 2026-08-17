import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ModalHeader, ModalBody, ModalFooter, InlineLoading } from '@carbon/react';
import { getPatientName } from '@openmrs/esm-framework';
import { useVoidPatient } from './useVoidPatient';
import styles from './void-patient-dialog.scss';

interface VoidPatientDialogProps {
  closeModal: () => void;
  patient: fhir.Patient;
  patientUuid: string;
}

const VoidPatientDialog: React.FC<VoidPatientDialogProps> = ({ closeModal, patient, patientUuid }) => {
  const { t } = useTranslation();
  const patientName = patient ? getPatientName(patient) : '';
  const { initiateVoidingPatient, isVoidingPatient } = useVoidPatient(patientUuid, patientName);

  const handleDelete = () => {
    initiateVoidingPatient();
    closeModal();
  };

  return (
    <div>
      <ModalHeader
        closeModal={closeModal}
        title={t('deletePatientDialogHeader', 'Are you sure you want to delete this patient?')}
      />
      <ModalBody>
        <p className={styles.body}>
          {t(
            'confirmDeletePatientText',
            'Deleting {{name}} will remove them from patient lists and search results. This can be undone shortly afterward from the confirmation notification.',
            { name: patientName },
          )}
        </p>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button kind="danger" onClick={handleDelete} disabled={isVoidingPatient}>
          {!isVoidingPatient ? (
            t('deletePatient', 'Delete patient')
          ) : (
            <InlineLoading description={t('deletingPatient', 'Deleting patient')} />
          )}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default VoidPatientDialog;
