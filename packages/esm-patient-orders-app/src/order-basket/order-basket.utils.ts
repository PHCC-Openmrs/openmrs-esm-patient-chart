import { type TFunction } from 'i18next';
import { type Workspace2DefinitionProps } from '@openmrs/esm-framework';
import { type OrderBasketItem, type OrderBasketExtensionProps } from '@openmrs/esm-patient-common-lib';

export interface CreateOrderBasketExtensionPropsArguments {
  patient: fhir.Patient;
  drugOrderWorkspaceName?: string;
  labOrderWorkspaceName?: string;
  generalOrderWorkspaceName?: string;
  launchChildWorkspace?: Workspace2DefinitionProps['launchChildWorkspace'];
  visibleOrderPanels?: Array<string>;
}

export function createOrderBasketExtensionProps({
  patient,
  drugOrderWorkspaceName,
  labOrderWorkspaceName,
  generalOrderWorkspaceName,
  launchChildWorkspace,
  visibleOrderPanels,
}: CreateOrderBasketExtensionPropsArguments): OrderBasketExtensionProps {
  const result: OrderBasketExtensionProps = {
    patient,
    visibleOrderPanels,
  };

  if (launchChildWorkspace) {
    if (drugOrderWorkspaceName) {
      result.launchDrugOrderForm = (order: OrderBasketItem) => {
        launchChildWorkspace(drugOrderWorkspaceName, { order });
      };
    }

    if (labOrderWorkspaceName) {
      result.launchLabOrderForm = (orderTypeUuid: string, order: OrderBasketItem) => {
        launchChildWorkspace(labOrderWorkspaceName, { orderTypeUuid, order });
      };
    }

    if (generalOrderWorkspaceName) {
      result.launchGeneralOrderForm = (orderTypeUuid: string, order: OrderBasketItem) => {
        launchChildWorkspace(generalOrderWorkspaceName, { orderTypeUuid, order });
      };
    }
  }

  return result;
}

interface RestValidationError {
  message?: string;
  globalErrors?: Array<{ message?: string }>;
  fieldErrors?: Record<string, Array<{ message?: string }>>;
}

/**
 * A failed order submission comes back as a REST validation error whose top-level message is just
 * "Invalid Submission"; what actually went wrong (e.g. a dose unit the server doesn't allow) is in
 * its field and global errors. Spell those out so the cause is visible in the order basket.
 */
export function getOrderSubmissionErrorMessage(error: unknown, t: TFunction): string {
  const restError: RestValidationError | undefined = (error as { responseBody?: { error?: RestValidationError } })
    ?.responseBody?.error;

  const fieldLabels: Record<string, string> = {
    doseUnits: t('doseUnit', 'Dose unit'),
    quantityUnits: t('quantityUnit', 'Quantity unit'),
    durationUnits: t('durationUnit', 'Duration unit'),
    route: t('route', 'Route'),
    frequency: t('frequency', 'Frequency'),
  };
  const details = [
    ...(restError?.globalErrors ?? []).map(({ message }) => message),
    ...Object.entries(restError?.fieldErrors ?? {}).flatMap(([field, errors]) =>
      (errors ?? []).map(({ message }) => (message ? `${fieldLabels[field] ?? field}: ${message}` : undefined)),
    ),
  ].filter(Boolean);

  if (details.length > 0) {
    return [...new Set(details)].join('; ');
  }
  return restError?.message || t('tryReopeningTheWorkspaceAgain', 'Please try launching the workspace again');
}
