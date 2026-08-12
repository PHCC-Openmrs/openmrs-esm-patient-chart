import React, { useCallback, useState } from 'react';
import { Button, InlineLoading, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { showSnackbar, getCoreTranslation } from '@openmrs/esm-framework';
import { deleteProgramSectionEncounter, useProgramSectionEncounters } from './program-section.resource';
import styles from './delete-program-section-encounter.scss';

interface DeleteProgramSectionEncounterModalProps {
  closeDeleteModal: () => void;
  encounterUuid: string;
  patientUuid: string;
  encounterTypeUuid: string;
  sectionTitle: string;
}

const DeleteProgramSectionEncounterModal: React.FC<DeleteProgramSectionEncounterModalProps> = ({
  closeDeleteModal,
  encounterUuid,
  patientUuid,
  encounterTypeUuid,
  sectionTitle,
}) => {
  const { t } = useTranslation();
  const { mutateEncounters } = useProgramSectionEncounters(patientUuid, encounterTypeUuid);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    const abortController = new AbortController();
    try {
      await deleteProgramSectionEncounter(encounterUuid, abortController);
      await mutateEncounters();
      closeDeleteModal();
      showSnackbar({
        isLowContrast: true,
        kind: 'success',
        title: t('sectionRecordDeleted', 'Record deleted'),
      });
    } catch (error) {
      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('errorDeletingSectionRecord', 'Error deleting record'),
        subtitle: error?.responseBody?.message ?? error?.message,
      });
    } finally {
      setIsDeleting(false);
    }
  }, [closeDeleteModal, encounterUuid, mutateEncounters, t]);

  return (
    <div>
      <ModalHeader
        closeModal={closeDeleteModal}
        title={t('deleteSectionRecordTitle', 'Delete {{sectionTitle}} record', { sectionTitle })}
      />
      <ModalBody>
        <p>
          {t(
            'deleteSectionRecordConfirmationText',
            'Are you sure you want to delete this record? This action cannot be undone.',
          )}
        </p>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeDeleteModal}>
          {getCoreTranslation('cancel', 'Cancel')}
        </Button>
        <Button className={styles.deleteButton} kind="danger" onClick={handleDelete} disabled={isDeleting}>
          {isDeleting ? (
            <InlineLoading description={t('deleting', 'Deleting') + '...'} />
          ) : (
            <span>{getCoreTranslation('confirm', 'Confirm')}</span>
          )}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default DeleteProgramSectionEncounterModal;
