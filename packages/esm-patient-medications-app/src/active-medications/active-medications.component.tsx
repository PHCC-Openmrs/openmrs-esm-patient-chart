import React from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableSkeleton } from '@carbon/react';
import { EmptyState, ErrorState, useLaunchWorkspaceRequiringVisit } from '@openmrs/esm-patient-common-lib';
import { useSession, userHasAccess } from '@openmrs/esm-framework';
import MedicationsDetailsTable from '../components/medications-details-table.component';
import { useMedicationOrders } from '../api';

interface ActiveMedicationsProps {
  patient: fhir.Patient;
}

const ActiveMedications: React.FC<ActiveMedicationsProps> = ({ patient }) => {
  const { t } = useTranslation();
  const headerTitle = t('activeMedicationsHeaderTitle', 'Active medications');
  const displayText = t('activeMedicationsDisplayText', 'active medications');

  const { activeOrders, error, isLoading, isValidating } = useMedicationOrders(patient?.id);
  const launchOrderBasket = useLaunchWorkspaceRequiringVisit(patient.id, 'order-basket');
  const session = useSession();
  const canManageOrders = userHasAccess('Task: patientChart.addDrugOrder', session?.user);

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  if (activeOrders?.length) {
    return (
      <MedicationsDetailsTable
        isValidating={isValidating}
        title={t('activeMedicationsTableTitle', 'Active Medications')}
        medications={activeOrders}
        showDiscontinueButton={true}
        showModifyButton={true}
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

export default ActiveMedications;
