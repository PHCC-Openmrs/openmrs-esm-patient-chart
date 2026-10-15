import React from 'react';
import { vi, describe, it, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isDesktop, useLayoutType } from '@openmrs/esm-framework';
import { mockBasePanel } from '__mocks__';
import { type GroupedObservation } from '../../types';
import LabSetPanel from './lab-set-panel.component';

const mockUseLayoutType = vi.mocked(useLayoutType);
const mockIsDesktop = vi.mocked(isDesktop);

describe('LabSetPanel', () => {
  const user = userEvent.setup();
  const mockSetActivePanel = vi.fn();

  it('renders the panel header, columns, and observations when provided', () => {
    render(<LabSetPanel activePanel={null} panel={mockBasePanel} setActivePanel={mockSetActivePanel} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /hematology/i })).toBeInTheDocument();
    expect(screen.getByText(/01 — Jan — 2024,\s+\d{1,2}:\d{2}(\s*[AP]M)?/i)).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /test name/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /value/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /reference range/i })).toBeInTheDocument();
    expect(screen.getByText(/test name/i)).toBeInTheDocument();
    expect(screen.getByText(/value/i)).toBeInTheDocument();
    expect(screen.getByText(/reference range/i)).toBeInTheDocument();
    const cbcRow = screen.getByRole('row', { name: /complete blood count.*120 g\/dL.*100-150 g\/dL/i });
    const hemoglobinRow = screen.getByRole('row', { name: /hemoglobin.*8 g\/dL.*12-16 g\/dL/i });
    const hematocritRow = screen.getByRole('row', { name: /hematocrit.*50 %.*35-45 %/i });

    expect(cbcRow).toBeInTheDocument();
    expect(hemoglobinRow).toBeInTheDocument();
    expect(hematocritRow).toBeInTheDocument();

    expect(cbcRow).not.toHaveClass('low', 'high');
    expect(hemoglobinRow).toHaveClass('low');
    expect(hematocritRow).toHaveClass('high');
  });

  it('clicking on the panel header sets the active panel', async () => {
    render(<LabSetPanel activePanel={null} panel={mockBasePanel} setActivePanel={mockSetActivePanel} />);

    const buttonElement = screen.getByRole('button', {
      name: /hematology/i,
    });

    await user.click(buttonElement);
    expect(mockSetActivePanel).toHaveBeenCalledWith(mockBasePanel);
  });

  it('renders the panel without reference ranges when not provided', () => {
    const panelWithoutRange = mockBasePanel;
    panelWithoutRange.entries.forEach((entry) => {
      entry.range = undefined;
    });

    render(<LabSetPanel activePanel={null} panel={panelWithoutRange} setActivePanel={mockSetActivePanel} />);

    expect(screen.getByRole('columnheader', { name: /test name/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /value/i })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /reference range/i })).not.toBeInTheDocument();

    expect(screen.getByRole('row', { name: /hemoglobin.*8 g\/dL/i })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /hematocrit.*50 %/i })).toBeInTheDocument();
  });

  it('renders a merged range test as one row with the lower bound reference range and the worst flag', () => {
    const rangeEntry = {
      obsDatetime: '2024-01-01T10:00:00.000Z',
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
      value: '100 – 120',
      interpretation: 'HIGH',
    };
    const rangePanel = {
      key: 'Range Test',
      date: '2024-01-01',
      flatName: 'Tests Orderability-Range Test',
      entries: [rangeEntry],
    } as unknown as GroupedObservation;

    render(<LabSetPanel activePanel={null} panel={rangePanel} setActivePanel={mockSetActivePanel} />);

    const rangeRow = screen.getByRole('row', { name: /range test.*100 – 120 mg\/dL.*90 – 110 mg\/dL/i });
    expect(rangeRow).toHaveClass('high');
    // header row + the single range test row
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('adjusts the table size based on the layout', () => {
    mockUseLayoutType.mockReturnValue('large-desktop');
    mockIsDesktop.mockReturnValue(true);

    const { rerender } = render(
      <LabSetPanel activePanel={null} panel={mockBasePanel} setActivePanel={mockSetActivePanel} />,
    );

    expect(screen.getByRole('table')).toHaveClass('cds--data-table--sm');

    mockUseLayoutType.mockReturnValue('tablet');
    mockIsDesktop.mockReturnValue(false);

    rerender(<LabSetPanel activePanel={null} panel={mockBasePanel} setActivePanel={mockSetActivePanel} />);

    expect(screen.getByRole('table')).toHaveClass('cds--data-table--md');
  });
});
