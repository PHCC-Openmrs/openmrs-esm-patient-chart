export const patientNursingFormWorkspace = 'patient-nursing-form-workspace';
export const nursingDeleteConfirmationModal = 'nursing-delete-confirmation-modal';

/**
 * Largest ECG file the nursing form accepts, in megabytes. Matches the Attachments module's
 * upload limit (attachments.maxUploadFileSize, which counts 1 MB as 1024 * 1024 bytes).
 */
export const ecgMaxFileSizeMb = 5;
export const ecgMaxFileSizeBytes = ecgMaxFileSizeMb * 1024 * 1024;
