import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { navigate, showSnackbar } from '@openmrs/esm-framework';
import { voidPatient, restorePatient } from './void-patient.resource';

export function useVoidPatient(patientUuid: string, patientName: string) {
  const { t } = useTranslation();
  const [isVoidingPatient, setIsVoidingPatient] = useState(false);

  const restoreVoidedPatient = () => {
    restorePatient(patientUuid)
      .then(() => {
        showSnackbar({
          title: t('patientRestored', 'Patient restored'),
          subtitle: t('patientRestoredSuccessfully', '{{name}} restored successfully', { name: patientName }),
          kind: 'success',
        });
        navigate({ to: '${openmrsSpaBase}/patient/${patientUuid}/chart', templateParams: { patientUuid } });
      })
      .catch(() => {
        showSnackbar({
          title: t('patientNotRestored', "Patient couldn't be restored"),
          kind: 'error',
          subtitle: t('errorWhenRestoringPatient', 'Error occurred when restoring {{name}}', { name: patientName }),
        });
      });
  };

  const initiateVoidingPatient = () => {
    setIsVoidingPatient(true);

    voidPatient(patientUuid)
      .then(() => {
        showSnackbar({
          title: t('patientDeleted', 'Patient deleted'),
          subtitle: t('patientDeletedSuccessfully', '{{name}} deleted successfully', { name: patientName }),
          kind: 'success',
          actionButtonLabel: t('undo', 'Undo'),
          onActionButtonClick: restoreVoidedPatient,
        });
        navigate({ to: '${openmrsSpaBase}/home' });
      })
      .catch(() => {
        showSnackbar({
          title: t('errorDeletingPatient', 'Error deleting patient'),
          kind: 'error',
          subtitle: t('errorOccurredDeletingPatient', 'An error occurred when deleting patient'),
        });
      })
      .finally(() => {
        setIsVoidingPatient(false);
      });
  };

  return { initiateVoidingPatient, isVoidingPatient };
}
