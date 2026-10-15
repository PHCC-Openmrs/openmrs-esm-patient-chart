import React from 'react';
import { vi, describe, it, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { showModal } from '@openmrs/esm-framework';
import { type GroupedObservation } from '../../types';
import IndividualResultsTable from './individual-results-table.component';

const mockShowModal = vi.mocked(showModal);

describe('IndividualResultsTable', () => {
  const mockSubRows = {
    key: 'HIV viral load',
    date: '2024-10-15',
    flatName: 'HIV viral load-HIV viral load',
    entries: [
      {
        obsDatetime: '2024-10-15 03:20:19.0',
        value: '45',
        interpretation: 'NORMAL',
        key: 'HIV viral load-HIV viral load',
        datatype: 'Numeric',
        lowAbsolute: 0,
        display: 'HIV viral load',
        conceptUuid: '856AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        units: 'copies/ml',
        flatName: 'HIV viral load-HIV viral load',
        hasData: true,
        range: '0 – 50', // Node-level range
        lowNormal: 0,
        hiNormal: 50,
      },
    ],
  } as GroupedObservation;

  const mockSubRowsWithObservationRange = {
    key: 'Alkaline phosphatase',
    date: '2024-10-15',
    flatName: 'Alkaline phosphatase',
    entries: [
      {
        obsDatetime: '2024-10-15 03:20:19.0',
        value: '15',
        interpretation: 'CRITICALLY_LOW',
        key: 'Alkaline phosphatase',
        datatype: 'Numeric',
        lowAbsolute: 0,
        display: 'Alkaline phosphatase',
        conceptUuid: '785AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        units: 'U/L',
        flatName: 'Alkaline phosphatase',
        hasData: true,
        range: '35 – 147', // Observation-level range (different from node-level)
        lowNormal: 35,
        hiNormal: 147,
        lowCritical: 25,
        hiCritical: 200,
      },
    ],
    range: '0 – 270', // Node-level range (fallback)
    units: 'U/L',
  } as GroupedObservation;

  const mockEmptySubRows = {
    key: 'HIV viral load',
    date: '2024-10-15',
    flatName: 'HIV viral load-HIV viral load',
    entries: [],
  } as GroupedObservation;

  it('renders a loading skeleton when fetching results data', () => {
    render(
      <IndividualResultsTable
        patientUuid={'patient-uuid'}
        isLoading={true}
        subRows={mockEmptySubRows}
        index={0}
        title={'HIV viral load'}
      />,
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders a tabular overview of the available test result data', () => {
    render(
      <IndividualResultsTable
        patientUuid={'patient-uuid'}
        isLoading={false}
        subRows={mockSubRows}
        index={0}
        title={'HIV viral load'}
      />,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByText(/15-Oct-2024/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/test name/i)).toBeInTheDocument();
    expect(screen.getByText(/reference range/i)).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /hiv viral load.*45 copies\/ml.*0 – 50 copies\/ml/i })).toBeInTheDocument();
  });

  it('uses observation-level range when available', () => {
    render(
      <IndividualResultsTable
        patientUuid={'patient-uuid'}
        isLoading={false}
        subRows={mockSubRowsWithObservationRange}
        index={0}
        title={'Alkaline phosphatase'}
      />,
    );

    // Should display observation-level range (35 – 147) not node-level (0 – 270)
    expect(screen.getByRole('row', { name: /alkaline phosphatase.*15 u\/l.*35 – 147 u\/l/i })).toBeInTheDocument();
  });
  it('renders a merged range test as one row with its worst flag and a trendline link', async () => {
    const user = userEvent.setup();
    const rangeEntry = {
      obsDatetime: '2024-10-15 03:20:19.0',
      key: 'Tests Orderability-Range Test',
      datatype: 'Numeric',
      display: 'Range Test',
      conceptUuid: '4881482b-0cc7-4201-8ce9-39f00e1fd5a4',
      units: 'mg/dL',
      flatName: 'Tests Orderability-Range Test',
      hasData: true,
      range: '90 – 110 mg/dL',
      lowNormal: 90,
      hiNormal: 110,
      isRangeResult: true,
    };
    const mockRangeSubRows = {
      key: 'Range Test',
      date: '2024-10-15',
      flatName: 'Tests Orderability-Range Test',
      entries: [
        { ...rangeEntry, value: '100 – 120', interpretation: 'CRITICALLY_HIGH' },
        { ...rangeEntry, obsDatetime: '2024-10-15 04:20:19.0', value: '? – 120', interpretation: 'NORMAL' },
      ],
    } as GroupedObservation;

    render(
      <IndividualResultsTable
        patientUuid={'patient-uuid'}
        isLoading={false}
        subRows={mockRangeSubRows}
        index={0}
        title={'Range Test'}
      />,
    );

    expect(screen.getByRole('row', { name: /range test.*100 – 120 mg\/dL.*90 – 110 mg\/dL/i })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '100 – 120 mg/dL' })).toHaveClass('critically-high');
    expect(screen.getByRole('row', { name: /range test.*\? – 120 mg\/dL.*90 – 110 mg\/dL/i })).toBeInTheDocument();

    // Even a range missing its lower bound can still open the trendline of the range test
    const [, secondRowTitle] = screen.getAllByText('Range Test', { selector: '[class*="trendline-link-view"]' });
    await user.click(secondRowTitle);
    expect(mockShowModal).toHaveBeenCalledWith(
      'timeline-results-modal',
      expect.objectContaining({ testUuid: '4881482b-0cc7-4201-8ce9-39f00e1fd5a4', title: 'Range Test' }),
    );
  });
});
