import React from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableSkeleton } from '@carbon/react';
import { EmptyState, ErrorState, useLaunchWorkspaceRequiringVisit } from '@openmrs/esm-patient-common-lib';
import { useSession, userHasAccess } from '@openmrs/esm-framework';
import { useMedicationOrders } from '../api';
import MedicationsDetailsTable from '../components/medications-details-table.component';

interface PastMedicationsProps {
  patient: fhir.Patient;
}

const PastMedications: React.FC<PastMedicationsProps> = ({ patient }) => {
  const { t } = useTranslation();
  const headerTitle = t('pastMedicationsHeaderTitle', 'Past medications');
  const displayText = t('pastMedicationsDisplayText', 'past medications');
  const launchOrderBasket = useLaunchWorkspaceRequiringVisit(patient.id, 'order-basket');
  const session = useSession();
  const canManageOrders = userHasAccess('Task: patientChart.addDrugOrder', session?.user);

  const { pastOrders, error, isLoading, isValidating } = useMedicationOrders(patient?.id);

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  if (pastOrders?.length) {
    return (
      <MedicationsDetailsTable
        isValidating={isValidating}
        title={t('pastMedicationsTableTitle', 'Past Medications')}
        medications={pastOrders}
        showDiscontinueButton={false}
        showModifyButton={false}
        showRenewButton={true}
        patient={patient}
      />
    );
  }

  return (
    <EmptyState
      displayText={displayText}
      headerTitle={headerTitle}
      launchForm={canManageOrders ? () => launchOrderBasket({}, { encounterUuid: '' }) : undefined}
    />
  );
};

export default PastMedications;
