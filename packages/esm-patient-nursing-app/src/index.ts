import { defineConfigSchema, getAsyncLifecycle, getSyncLifecycle } from '@openmrs/esm-framework';
import { createDashboardLink } from '@openmrs/esm-patient-common-lib';
import { configSchema } from './config-schema';
import { dashboardMeta } from './dashboard.meta';
import nursingMainComponent from './nursing-main.component';
import nursingOverviewComponent from './nursing-overview.component';

const moduleName = '@openmrs/esm-patient-nursing-app';

const options = {
  featureName: 'patient-nursing',
  moduleName,
};

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
}

export const nursingMain = getSyncLifecycle(nursingMainComponent, options);

export const nursingOverview = getSyncLifecycle(nursingOverviewComponent, options);

export const nursingDashboardLink =
  // t('Nursing', 'Nursing')
  getSyncLifecycle(createDashboardLink({ ...dashboardMeta }), options);

export const nursingFormWorkspace = getAsyncLifecycle(() => import('./nursing-form/nursing-form.workspace'), options);

export const nursingDeleteConfirmationModal = getAsyncLifecycle(
  () => import('./components/delete-nursing-modal/delete-nursing.modal'),
  options,
);
