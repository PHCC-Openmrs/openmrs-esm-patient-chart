import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, InlineLoading, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import { deleteNursingEncounter, useInvalidateNursingRecords } from '../../common';

interface DeleteNursingModalProps {
  patientUuid: string;
  encounterUuid: string;
  closeDeleteModal: () => void;
}

const DeleteNursingModal: React.FC<DeleteNursingModalProps> = ({ encounterUuid, patientUuid, closeDeleteModal }) => {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);
  const invalidateNursingRecords = useInvalidateNursingRecords(patientUuid);

  const handleDelete = useCallback(() => {
    if (!encounterUuid) {
      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('errorDeletingNursing', 'Error deleting nursing record'),
        subtitle: t('encounterUuidRequired', 'Encounter UUID is required to delete a nursing record'),
      });
      return;
    }

    setIsDeleting(true);
    deleteNursingEncounter(encounterUuid)
      .then(() => {
        invalidateNursingRecords();
        closeDeleteModal();
        showSnackbar({
          isLowContrast: true,
          kind: 'success',
          title: t('nursingRecordDeleted', 'Nursing record deleted'),
        });
      })
      .catch((error) => {
        console.error('Error deleting nursing encounter: ', error);
        showSnackbar({
          isLowContrast: false,
          kind: 'error',
          title: t('errorDeletingNursing', 'Error deleting nursing record'),
          subtitle: error?.message,
        });
      })
      .finally(() => setIsDeleting(false));
  }, [encounterUuid, t, closeDeleteModal, invalidateNursingRecords]);

  return (
    <>
      <ModalHeader closeModal={closeDeleteModal} title={t('deleteNursingRecord', 'Delete nursing record')} />
      <ModalBody>
        <p>
          {t(
            'deleteNursingConfirmationText',
            'Note: Deleting this entry removes every dressing, other measure and nursing procedure recorded alongside it. Are you sure you want to continue?',
          )}
        </p>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeDeleteModal}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button kind="danger" onClick={handleDelete} disabled={isDeleting}>
          {isDeleting ? (
            <InlineLoading description={t('deleting', 'Deleting') + '...'} />
          ) : (
            <span>{t('delete', 'Delete')}</span>
          )}
        </Button>
      </ModalFooter>
    </>
  );
};

export default DeleteNursingModal;
