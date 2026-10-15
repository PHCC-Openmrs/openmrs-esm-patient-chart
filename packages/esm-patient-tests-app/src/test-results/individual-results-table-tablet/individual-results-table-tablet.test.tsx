import React from 'react';
import { vi, describe, it, expect, test, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { isDesktop, openmrsFetch, useConfig, useLayoutType } from '@openmrs/esm-framework';
import { type ConfigObject } from '../../config-schema';
import { mockResults } from '__mocks__';
import { FilterProvider, type Roots } from '../filter/filter-context';
import IndividualResultsTableTablet from './individual-results-table-tablet.component';

const mockIsDesktop = vi.mocked(isDesktop);
const mockUseLayoutType = vi.mocked(useLayoutType);
const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);

vi.mock('./usePanelData');

describe('PanelView', () => {
  beforeEach(() => {
    mockUseLayoutType.mockReturnValue('large-desktop');
    mockIsDesktop.mockReturnValue(true);
  });

  it('renders a loading state when data is loading', () => {
    render(
      <FilterProvider roots={mockResults as Roots} isLoading={true}>
        <IndividualResultsTableTablet expanded={false} patientUuid="test-patient" />
      </FilterProvider>,
    );

    const skeletonTables = screen.getAllByTestId('cds--data-table-container');
    expect(skeletonTables.length).toBeGreaterThan(0);
  });

  it('renders an empty state when there are no panels to display', () => {
    render(
      <FilterProvider roots={[]} isLoading={false}>
        <IndividualResultsTableTablet expanded={false} patientUuid="test-patient" />
      </FilterProvider>,
    );

    expect(screen.getByText(/no panels found/i)).toBeInTheDocument();
    expect(screen.getByText(/there are no panels to display for this patient/i)).toBeInTheDocument();
  });

  it('renders the panel view when data is loaded', () => {
    mockUseLayoutType.mockReturnValue('large-desktop');
    mockIsDesktop.mockReturnValue(true);

    render(
      <FilterProvider roots={mockResults as Roots} isLoading={false}>
        <IndividualResultsTableTablet expanded={false} patientUuid="test-patient" />
      </FilterProvider>,
    );

    expect(screen.getByRole('heading', { name: /complete blood count/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /hiv viral load/i })).toBeInTheDocument();
    // This observation belongs to two panels
    expect(screen.getAllByRole('row', { name: /platelets.*56/i })).toHaveLength(2);
    expect(screen.getByRole('row', { name: /hiv viral load.*600/i })).toBeInTheDocument();
  });

  it('filters the panel view when searching for a test', async () => {
    const user = userEvent.setup();

    mockUseLayoutType.mockReturnValue('tablet');
    render(
      <FilterProvider roots={mockResults as Roots} isLoading={false}>
        <IndividualResultsTableTablet expanded={false} patientUuid="test-patient" />
      </FilterProvider>,
    );

    const searchButton = screen.getByRole('button', { name: /search/i });
    expect(searchButton).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /complete blood count/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /hematology/i })).toBeInTheDocument();
    // This observation belongs to both panels
    expect(screen.getAllByRole('row', { name: /platelets.*56/i })).toHaveLength(2);
    expect(screen.getByRole('row', { name: /hiv viral load.*600/i })).toBeInTheDocument();

    await user.click(searchButton);

    const searchBox = screen.getByPlaceholderText(/search by test name/i);
    expect(searchBox).toBeInTheDocument();

    await user.type(searchBox, 'hiv viral load');
    await user.keyboard('{Enter}');

    expect(screen.queryByRole('row', { name: /platelets.*56/i })).not.toBeInTheDocument();
    expect(screen.getByRole('row', { name: /hiv viral load.*600/i })).toBeInTheDocument();
  });

  it('selecting a test opens the timeline view on tablet', async () => {
    const user = userEvent.setup();

    mockUseLayoutType.mockReturnValue('tablet');
    mockIsDesktop.mockReturnValue(true);

    render(
      <FilterProvider roots={mockResults as Roots} isLoading={false}>
        <IndividualResultsTableTablet expanded={false} patientUuid="test-patient" />
      </FilterProvider>,
    );

    const hivViralLoadCell = screen.getByRole('cell', { name: /hiv viral load/i });
    await user.click(hivViralLoadCell);

    expect(screen.getByRole('banner', { name: /hiv viral load/i })).toBeInTheDocument();

    const backButton = screen.getByRole('button', { name: /back/i });
    expect(backButton).toBeInTheDocument();
    await user.click(backButton);

    expect(backButton).not.toBeInTheDocument();
    expect(screen.getByRole('row', { name: /hiv viral load.*600/i })).toBeInTheDocument();
  });

  it('applies the overlay sticky header fix when opening a panel overlay on tablet', async () => {
    const user = userEvent.setup();

    mockUseLayoutType.mockReturnValue('tablet');
    mockIsDesktop.mockReturnValue(false);

    render(
      <FilterProvider roots={mockResults as Roots} isLoading={false}>
        <IndividualResultsTableTablet expanded={false} patientUuid="test-patient" />
      </FilterProvider>,
    );

    const hivViralLoadCell = screen.getByRole('cell', { name: /hiv viral load/i });
    await user.click(hivViralLoadCell);

    // The panel header in the overlay should have the panelHeaderOverlay class
    // which sets top: 0 instead of the default top: 6rem
    // eslint-disable-next-line testing-library/no-node-access
    const panelHeader = document.querySelector('[data-panel-name="HIV viral load"]');
    expect(panelHeader).toBeInTheDocument();
    expect(panelHeader).toHaveClass('panelHeaderOverlay');
  });

  it('shows a range test nested in a panel as one row and opens its timeline', async () => {
    const rangeTestUuid = '4881482b-0cc7-4201-8ce9-39f00e1fd5a4';
    const bound = (display: string, conceptUuid: string, value: string) => ({
      display,
      flatName: `Tests Orderability-Range Test-${display}`,
      conceptUuid,
      units: 'mg/dL',
      hasData: true,
      obs: [{ obsDatetime: '2024-02-01T10:00:00.000Z', value, interpretation: 'NORMAL' }],
    });
    const roots = [
      {
        display: 'Tests Orderability',
        flatName: 'Tests Orderability',
        hasData: true,
        subSets: [
          {
            display: 'Range Test',
            flatName: 'Tests Orderability-Range Test',
            hasData: true,
            subSets: [bound('Range Test Lower', 'lower-uuid', '100'), bound('Range Test Upper', 'upper-uuid', '120')],
          },
        ],
      },
    ];
    mockUseConfig.mockReturnValue({ rangeResultConcepts: [rangeTestUuid] } as ConfigObject);
    mockOpenmrsFetch.mockResolvedValue({
      data: {
        results: [
          {
            uuid: rangeTestUuid,
            setMembers: [
              { uuid: 'lower-uuid', datatype: { display: 'Numeric' } },
              { uuid: 'upper-uuid', datatype: { display: 'Numeric' } },
            ],
          },
        ],
      },
    } as any);

    render(
      <FilterProvider roots={roots as Roots} isLoading={false}>
        <IndividualResultsTableTablet expanded={false} patientUuid="test-patient" />
      </FilterProvider>,
    );

    expect(await screen.findByRole('row', { name: /range test.*100 – 120 mg\/dL/i })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /range test lower/i })).not.toBeInTheDocument();
    // The merged range test has no lowest parent of its own, yet its timeline still renders under its name
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector('[data-panel-name="Range Test"]')).toBeInTheDocument();
    expect(screen.getByText('100 – 120')).toBeInTheDocument();

    mockUseConfig.mockReturnValue({} as ConfigObject);
  });
});
