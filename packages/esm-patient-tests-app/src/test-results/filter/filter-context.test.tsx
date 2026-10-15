import React, { useContext } from 'react';
import { vi, describe, it, expect, test, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { type RangeResultConcept } from '@openmrs/esm-patient-common-lib';
import { type ConfigObject } from '../../config-schema';
import GroupedTimeline from '../grouped-timeline/grouped-timeline.component';
import { FilterProvider, FilterContext, mergeRangeResults } from './filter-context';
import { type TreeNode } from './filter-types';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);

// Test component to access context values
const TestConsumer = () => {
  const {
    activeTests,
    someChecked,
    totalResultsCount,
    filteredResultsCount,
    timelineData,
    tableData,
    toggleVal,
    updateParent,
    resetTree,
  } = useContext(FilterContext);

  return (
    <div>
      <div data-testid="active-tests">{activeTests.join(',')}</div>
      <div data-testid="some-checked">{someChecked.toString()}</div>
      <div data-testid="total-count">{totalResultsCount}</div>
      <div data-testid="filtered-count">{filteredResultsCount}</div>
      <div data-testid="timeline-loaded">{timelineData?.loaded.toString()}</div>
      <div data-testid="timeline-rows">{timelineData?.data?.rowData?.length || 0}</div>
      <div data-testid="table-groups">{tableData?.length || 0}</div>
      <button onClick={() => toggleVal('Test1')}>Toggle Test1</button>
      <button onClick={() => updateParent('Panel1')}>Toggle Panel1</button>
      <button onClick={resetTree}>Reset</button>
    </div>
  );
};

const mockRoots: Array<TreeNode> = [
  {
    display: 'Complete Blood Count',
    flatName: 'CBC',
    hasData: true,
    subSets: [
      {
        display: 'Hemoglobin',
        flatName: 'CBC: Hemoglobin',
        hasData: true,
        obs: [
          {
            obsDatetime: '2024-01-15T10:00:00.000Z',
            value: '12.5',
            interpretation: 'NORMAL',
          },
          {
            obsDatetime: '2024-01-10T10:00:00.000Z',
            value: '12.0',
            interpretation: 'NORMAL',
          },
        ],
        subSets: [],
      },
      {
        display: 'White Blood Cell Count',
        flatName: 'CBC: WBC',
        hasData: true,
        obs: [
          {
            obsDatetime: '2024-01-15T10:00:00.000Z',
            value: '7.5',
            interpretation: 'NORMAL',
          },
        ],
        subSets: [],
      },
    ],
  },
  {
    display: 'Lipid Panel',
    flatName: 'Lipid',
    hasData: true,
    subSets: [
      {
        display: 'Total Cholesterol',
        flatName: 'Lipid: Cholesterol',
        hasData: true,
        obs: [
          {
            obsDatetime: '2024-01-20T10:00:00.000Z',
            value: '180',
            interpretation: 'NORMAL',
          },
        ],
        subSets: [],
      },
    ],
  },
];

describe('FilterContext', () => {
  describe('Initialization', () => {
    it('should initialize with roots data', async () => {
      render(
        <FilterProvider roots={mockRoots} isLoading={false}>
          <TestConsumer />
        </FilterProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('timeline-loaded')).toHaveTextContent('true');
      });
    });

    it('should compute totalResultsCount from all observations', async () => {
      render(
        <FilterProvider roots={mockRoots} isLoading={false}>
          <TestConsumer />
        </FilterProvider>,
      );

      await waitFor(() => {
        // 2 hemoglobin + 1 WBC + 1 cholesterol = 4 total
        expect(screen.getByTestId('total-count')).toHaveTextContent('4');
      });
    });

    it('should show filteredResultsCount equal to totalResultsCount when no filters applied', async () => {
      render(
        <FilterProvider roots={mockRoots} isLoading={false}>
          <TestConsumer />
        </FilterProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('filtered-count')).toHaveTextContent('4');
      });
      expect(screen.getByTestId('some-checked')).toHaveTextContent('false');
    });
  });

  describe('Active tests tracking', () => {
    it('should track activeTests when checkboxes are toggled', async () => {
      const user = userEvent.setup();

      render(
        <FilterProvider roots={mockRoots} isLoading={false}>
          <TestConsumer />
        </FilterProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('timeline-loaded')).toHaveTextContent('true');
      });

      const toggleButton = screen.getByRole('button', { name: /toggle test1/i });
      await user.click(toggleButton);

      expect(screen.getByTestId('active-tests')).toHaveTextContent('Test1');
      expect(screen.getByTestId('some-checked')).toHaveTextContent('true');
    });

    it('should update someChecked when tests are selected', async () => {
      const user = userEvent.setup();

      render(
        <FilterProvider roots={mockRoots} isLoading={false}>
          <TestConsumer />
        </FilterProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('timeline-loaded')).toHaveTextContent('true');
      });

      expect(screen.getByTestId('some-checked')).toHaveTextContent('false');

      await user.click(screen.getByRole('button', { name: /toggle test1/i }));

      expect(screen.getByTestId('some-checked')).toHaveTextContent('true');
    });
  });

  describe('Filtered results count', () => {
    it('should update filteredResultsCount when filters are applied', async () => {
      const user = userEvent.setup();

      const FilterTestComponent = () => {
        const { toggleVal, filteredResultsCount, totalResultsCount, someChecked } = useContext(FilterContext);

        return (
          <div>
            <div data-testid="total-count">{totalResultsCount}</div>
            <div data-testid="filtered-count">{filteredResultsCount}</div>
            <div data-testid="some-checked">{someChecked.toString()}</div>
            <button onClick={() => toggleVal('CBC: Hemoglobin')}>Toggle Hemoglobin</button>
          </div>
        );
      };

      render(
        <FilterProvider roots={mockRoots} isLoading={false}>
          <FilterTestComponent />
        </FilterProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('total-count')).toHaveTextContent('4');
      });

      expect(screen.getByTestId('filtered-count')).toHaveTextContent('4');
      expect(screen.getByTestId('some-checked')).toHaveTextContent('false');

      await user.click(screen.getByRole('button', { name: /toggle hemoglobin/i }));
      await waitFor(() => {
        expect(screen.getByTestId('filtered-count')).toHaveTextContent('2');
      });
      expect(screen.getByTestId('some-checked')).toHaveTextContent('true');
    });
  });

  describe('Timeline data', () => {
    it('should generate timeline data with all tests when no filters applied', async () => {
      render(
        <FilterProvider roots={mockRoots} isLoading={false}>
          <TestConsumer />
        </FilterProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('timeline-loaded')).toHaveTextContent('true');
      });
      expect(screen.getByTestId('timeline-rows')).toHaveTextContent('3');
    });

    it('should filter timeline data when tests are selected', async () => {
      const user = userEvent.setup();

      const TimelineTestComponent = () => {
        const { toggleVal, timelineData } = useContext(FilterContext);

        return (
          <div>
            <div data-testid="timeline-rows">{timelineData?.data?.rowData?.length || 0}</div>
            <button onClick={() => toggleVal('CBC: Hemoglobin')}>Toggle Hemoglobin</button>
          </div>
        );
      };

      render(
        <FilterProvider roots={mockRoots} isLoading={false}>
          <TimelineTestComponent />
        </FilterProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('timeline-rows')).toHaveTextContent('3');
      });

      await user.click(screen.getByRole('button', { name: /toggle hemoglobin/i }));

      await waitFor(() => {
        expect(screen.getByTestId('timeline-rows')).toHaveTextContent('1');
      });
    });

    it('should collapse duplicate branches in timeline data and keep alias filters working', async () => {
      const user = userEvent.setup();
      const sharedConceptUuid = '729AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      const primaryFlatName = 'Hematology-Complete blood count-Platelets';
      const selectedFlatName = 'Chemistry-Complete blood count-Platelets';
      const sharedObs = [{ obsDatetime: '2024-11-04T05:48:00.000Z', value: '56.0', interpretation: 'LOW' as const }];

      const roots: Array<TreeNode> = [
        {
          display: 'Hematology',
          flatName: 'Hematology',
          hasData: true,
          subSets: [
            {
              display: 'Complete blood count',
              flatName: 'Hematology-Complete blood count',
              hasData: true,
              subSets: [
                {
                  display: 'Platelets',
                  flatName: primaryFlatName,
                  conceptUuid: sharedConceptUuid,
                  hasData: true,
                  obs: sharedObs,
                  subSets: [],
                },
              ],
            },
          ],
        },
        {
          display: 'Chemistry',
          flatName: 'Chemistry',
          hasData: true,
          subSets: [
            {
              display: 'Complete blood count',
              flatName: 'Chemistry-Complete blood count',
              hasData: true,
              subSets: [
                {
                  display: 'Platelets',
                  flatName: selectedFlatName,
                  conceptUuid: sharedConceptUuid,
                  hasData: true,
                  obs: sharedObs,
                  subSets: [],
                },
              ],
            },
          ],
        },
      ];

      const TimelineAliasConsumer = () => {
        const { toggleVal, timelineData } = useContext(FilterContext);
        const rows = timelineData?.data?.rowData ?? [];

        return (
          <div>
            <div data-testid="timeline-rows">{rows.length}</div>
            <div data-testid="timeline-flat-names">{rows.flatMap((row) => row.flatNames ?? []).join(',')}</div>
            <button onClick={() => toggleVal(selectedFlatName)}>Toggle Chemistry Platelets</button>
          </div>
        );
      };

      render(
        <FilterProvider roots={roots} isLoading={false}>
          <TimelineAliasConsumer />
        </FilterProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('timeline-rows')).toHaveTextContent('1');
      });
      expect(screen.getByTestId('timeline-flat-names')).toHaveTextContent(selectedFlatName);

      await user.click(screen.getByRole('button', { name: /toggle chemistry platelets/i }));

      await waitFor(() => {
        expect(screen.getByTestId('timeline-rows')).toHaveTextContent('1');
      });
    });

    it('should sort timeline observations by date descending', async () => {
      const TimelineDetailsComponent = () => {
        const { timelineData } = useContext(FilterContext);

        return (
          <div>
            <div data-testid="timeline-loaded">{timelineData?.loaded.toString()}</div>
            {timelineData?.data?.parsedTime?.sortedTimes && (
              <div data-testid="first-time">{timelineData.data.parsedTime.sortedTimes[0]}</div>
            )}
          </div>
        );
      };

      render(
        <FilterProvider roots={mockRoots} isLoading={false}>
          <TimelineDetailsComponent />
        </FilterProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('timeline-loaded')).toHaveTextContent('true');
      });

      const firstTime = screen.getByTestId('first-time').textContent;
      expect(firstTime).toContain('2024-01-20');
    });
  });

  describe('Table data', () => {
    it('should generate grouped table data', async () => {
      render(
        <FilterProvider roots={mockRoots} isLoading={false}>
          <TestConsumer />
        </FilterProvider>,
      );

      await waitFor(() => {
        const tableGroups = screen.getByTestId('table-groups');
        expect(parseInt(tableGroups.textContent || '0')).toBeGreaterThan(0);
      });
    });

    it('should group observations by panel and date', async () => {
      const TableTestComponent = () => {
        const { tableData } = useContext(FilterContext);

        return (
          <div>
            <div data-testid="table-groups">{tableData?.length || 0}</div>
            {tableData?.map((group, index) => (
              <div key={index} data-testid={`group-${index}`}>
                {group.key} - {group.date} - {group.entries.length}
              </div>
            ))}
          </div>
        );
      };

      render(
        <FilterProvider roots={mockRoots} isLoading={false}>
          <TableTestComponent />
        </FilterProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('table-groups')).not.toHaveTextContent('0');
      });

      const groups = screen.getAllByTestId(/^group-/);
      expect(groups.length).toBeGreaterThan(0);
    });
  });

  describe('Table data de-duplication by conceptUuid', () => {
    const sharedConceptUuid = '729AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const sharedObs = [{ obsDatetime: '2024-11-04T05:48:00.000Z', value: '56.0', interpretation: 'LOW' as const }];

    const PlateletEntryConsumer = () => {
      const { tableData } = useContext(FilterContext);
      const plateletEntries = (tableData ?? [])
        .flatMap((group) => group.entries)
        .filter((entry) => entry.conceptUuid === sharedConceptUuid);

      return (
        <div>
          <div data-testid="table-groups">{tableData?.length ?? 0}</div>
          <div data-testid="platelet-entry-count">{plateletEntries.length}</div>
        </div>
      );
    };

    it('collapses the same observation appearing twice within one rendered panel', async () => {
      // Two leaves resolve to the same panel group key ("Complete blood count") but
      // carry distinct flatNames, mirroring obstree returning one branch per order.
      // They share a conceptUuid and identical obs, so they must collapse to one row.
      const roots: Array<TreeNode> = [
        {
          display: 'Hematology',
          flatName: 'Hematology',
          hasData: true,
          subSets: [
            {
              display: 'Complete blood count',
              flatName: 'Hematology-Complete blood count',
              hasData: true,
              subSets: [
                {
                  display: 'Platelets',
                  flatName: 'Hematology-Complete blood count-Platelets',
                  conceptUuid: sharedConceptUuid,
                  hasData: true,
                  obs: sharedObs,
                  subSets: [],
                },
              ],
            },
          ],
        },
        {
          display: 'Chemistry',
          flatName: 'Chemistry',
          hasData: true,
          subSets: [
            {
              display: 'Complete blood count',
              flatName: 'Chemistry-Complete blood count',
              hasData: true,
              subSets: [
                {
                  display: 'Platelets',
                  flatName: 'Chemistry-Complete blood count-Platelets',
                  conceptUuid: sharedConceptUuid,
                  hasData: true,
                  obs: sharedObs,
                  subSets: [],
                },
              ],
            },
          ],
        },
      ];

      render(
        <FilterProvider roots={roots} isLoading={false}>
          <PlateletEntryConsumer />
        </FilterProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('platelet-entry-count')).toHaveTextContent('1');
      });
    });

    it('keeps the same observation that legitimately renders under two different panels', async () => {
      // Same conceptUuid and obs, but the leaves resolve to different panel group
      // keys ("Complete blood count" vs "Hematology"), mirroring a concept mounted
      // beneath two roots. Both rows must survive.
      const roots: Array<TreeNode> = [
        {
          display: 'Hematology',
          flatName: 'Hematology',
          hasData: true,
          subSets: [
            {
              display: 'Complete blood count',
              flatName: 'Hematology-Complete blood count',
              hasData: true,
              subSets: [
                {
                  display: 'Platelets',
                  flatName: 'Hematology-Complete blood count-Platelets',
                  conceptUuid: sharedConceptUuid,
                  hasData: true,
                  obs: sharedObs,
                  subSets: [],
                },
              ],
            },
          ],
        },
        {
          display: 'Bloodwork',
          flatName: 'Bloodwork',
          hasData: true,
          subSets: [
            {
              display: 'Hematology',
              flatName: 'Bloodwork-Hematology',
              hasData: true,
              subSets: [
                {
                  display: 'Complete blood count',
                  flatName: 'Bloodwork-Hematology-Complete blood count',
                  hasData: true,
                  subSets: [
                    {
                      display: 'Platelets',
                      flatName: 'Bloodwork-Hematology-Complete blood count-Platelets',
                      conceptUuid: sharedConceptUuid,
                      hasData: true,
                      obs: sharedObs,
                      subSets: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];

      render(
        <FilterProvider roots={roots} isLoading={false}>
          <PlateletEntryConsumer />
        </FilterProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('platelet-entry-count')).toHaveTextContent('2');
      });
    });
  });

  describe('Normalized branch counts and true duplicate results', () => {
    const sharedConceptUuid = '729AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const obsAt = (value: string) => ({
      obsDatetime: '2024-11-04T05:48:00.000Z',
      value,
      interpretation: 'LOW' as const,
    });

    const CountsConsumer = () => {
      const { tableData, totalResultsCount } = useContext(FilterContext);
      const plateletEntries = (tableData ?? [])
        .flatMap((group) => group.entries)
        .filter((entry) => entry.conceptUuid === sharedConceptUuid);

      return (
        <div>
          <div data-testid="platelet-entry-count">{plateletEntries.length}</div>
          <div data-testid="total-results-count">{totalResultsCount}</div>
        </div>
      );
    };

    const plateletLeaf = (flatName: string, obs: Array<ReturnType<typeof obsAt>>) => ({
      display: 'Platelets',
      flatName,
      conceptUuid: sharedConceptUuid,
      hasData: true,
      obs,
      subSets: [],
    });

    it('keeps the header count aligned with rendered rows when duplicate branches differ in flatName', async () => {
      // Two branches with different flatNames resolve to the same rendered
      // panel ("Complete blood count") and carry copies of the same obs list.
      // They collapse to one row, and the count must follow the rows.
      const roots: Array<TreeNode> = [
        {
          display: 'Hematology',
          flatName: 'Hematology',
          hasData: true,
          subSets: [
            {
              display: 'Complete blood count',
              flatName: 'Hematology-Complete blood count',
              hasData: true,
              subSets: [plateletLeaf('Hematology-Complete blood count-Platelets', [obsAt('56.0')])],
            },
          ],
        },
        {
          display: 'Chemistry',
          flatName: 'Chemistry',
          hasData: true,
          subSets: [
            {
              display: 'Complete blood count',
              flatName: 'Chemistry-Complete blood count',
              hasData: true,
              subSets: [plateletLeaf('Chemistry-Complete blood count-Platelets', [obsAt('56.0')])],
            },
          ],
        },
      ];

      render(
        <FilterProvider roots={roots} isLoading={false}>
          <CountsConsumer />
        </FilterProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('platelet-entry-count')).toHaveTextContent('1');
      });
      expect(screen.getByTestId('total-results-count')).toHaveTextContent('1');
    });

    it('keeps the header count aligned with rendered rows when duplicate branches share a flatName', async () => {
      // Two roots produce the identical leaf flatName, mirroring the default
      // Hematology + Bloodwork config after augmentation drops the Bloodwork
      // prefix. One result must render as one row and count as one result,
      // regardless of which layer collapses the duplicate.
      const roots: Array<TreeNode> = [
        {
          display: 'Hematology',
          flatName: 'Hematology',
          hasData: true,
          subSets: [
            {
              display: 'Complete blood count',
              flatName: 'Hematology-Complete blood count',
              hasData: true,
              subSets: [plateletLeaf('Hematology-Complete blood count-Platelets', [obsAt('56.0')])],
            },
          ],
        },
        {
          display: 'Bloodwork',
          flatName: 'Bloodwork',
          hasData: true,
          subSets: [
            {
              display: 'Complete blood count',
              flatName: 'Hematology-Complete blood count',
              hasData: true,
              subSets: [plateletLeaf('Hematology-Complete blood count-Platelets', [obsAt('56.0')])],
            },
          ],
        },
      ];

      render(
        <FilterProvider roots={roots} isLoading={false}>
          <CountsConsumer />
        </FilterProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('platelet-entry-count')).toHaveTextContent('1');
      });
      expect(screen.getByTestId('total-results-count')).toHaveTextContent('1');
    });

    it('keeps two genuinely distinct results with equal value and datetime as two rows', async () => {
      // Equal obs within a single branch's list are distinct real results
      // (e.g. one result per order, entered against the same encounter), not
      // copies. Both must render and both must count.
      const roots: Array<TreeNode> = [
        {
          display: 'Hematology',
          flatName: 'Hematology',
          hasData: true,
          subSets: [
            {
              display: 'Complete blood count',
              flatName: 'Hematology-Complete blood count',
              hasData: true,
              subSets: [plateletLeaf('Hematology-Complete blood count-Platelets', [obsAt('56.0'), obsAt('56.0')])],
            },
          ],
        },
      ];

      render(
        <FilterProvider roots={roots} isLoading={false}>
          <CountsConsumer />
        </FilterProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('platelet-entry-count')).toHaveTextContent('2');
      });
      expect(screen.getByTestId('total-results-count')).toHaveTextContent('2');
    });
  });

  describe('Actions', () => {
    it('should toggle individual test via toggleVal', async () => {
      const user = userEvent.setup();

      const ActionTestComponent = () => {
        const { toggleVal, checkboxes } = useContext(FilterContext);

        return (
          <div>
            <div data-testid="checkbox-state">{checkboxes['CBC: Hemoglobin']?.toString() || 'false'}</div>
            <button onClick={() => toggleVal('CBC: Hemoglobin')}>Toggle</button>
          </div>
        );
      };

      render(
        <FilterProvider roots={mockRoots} isLoading={false}>
          <ActionTestComponent />
        </FilterProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('checkbox-state')).toBeInTheDocument();
      });

      expect(screen.getByTestId('checkbox-state')).toHaveTextContent('false');

      await user.click(screen.getByRole('button', { name: /toggle/i }));

      await waitFor(() => {
        expect(screen.getByTestId('checkbox-state')).toHaveTextContent('true');
      });
    });

    it('should reset all filters via resetTree', async () => {
      const user = userEvent.setup();

      const ResetTestComponent = () => {
        const { toggleVal, resetTree, checkboxes, someChecked } = useContext(FilterContext);

        return (
          <div>
            <div data-testid="some-checked">{someChecked.toString()}</div>
            <div data-testid="hemoglobin-state">{checkboxes['CBC: Hemoglobin']?.toString() || 'false'}</div>
            <button onClick={() => toggleVal('CBC: Hemoglobin')}>Toggle Hemoglobin</button>
            <button onClick={resetTree}>Reset</button>
          </div>
        );
      };

      render(
        <FilterProvider roots={mockRoots} isLoading={false}>
          <ResetTestComponent />
        </FilterProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('some-checked')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /toggle hemoglobin/i }));

      await waitFor(() => {
        expect(screen.getByTestId('some-checked')).toHaveTextContent('true');
      });
      expect(screen.getByTestId('hemoglobin-state')).toHaveTextContent('true');

      await user.click(screen.getByRole('button', { name: /reset/i }));

      await waitFor(() => {
        expect(screen.getByTestId('some-checked')).toHaveTextContent('false');
      });
      expect(screen.getByTestId('hemoglobin-state')).toHaveTextContent('false');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty roots gracefully', () => {
      render(
        <FilterProvider roots={[]} isLoading={false}>
          <TestConsumer />
        </FilterProvider>,
      );

      expect(screen.getByTestId('total-count')).toHaveTextContent('0');
      expect(screen.getByTestId('filtered-count')).toHaveTextContent('0');
    });

    it('should handle tests with no observations', async () => {
      const emptyRoots: Array<TreeNode> = [
        {
          display: 'Empty Panel',
          flatName: 'Empty',
          hasData: false,
          subSets: [
            {
              display: 'Empty Test',
              flatName: 'Empty: Test',
              hasData: false,
              obs: [],
              subSets: [],
            },
          ],
        },
      ];

      render(
        <FilterProvider roots={emptyRoots} isLoading={false}>
          <TestConsumer />
        </FilterProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('total-count')).toHaveTextContent('0');
      });
    });

    it('should reflect isLoading prop', () => {
      const LoadingTestComponent = () => {
        const { isLoading } = useContext(FilterContext);
        return <div data-testid="is-loading">{isLoading.toString()}</div>;
      };

      const { rerender } = render(
        <FilterProvider roots={mockRoots} isLoading={true}>
          <LoadingTestComponent />
        </FilterProvider>,
      );

      expect(screen.getByTestId('is-loading')).toHaveTextContent('true');

      rerender(
        <FilterProvider roots={mockRoots} isLoading={false}>
          <LoadingTestComponent />
        </FilterProvider>,
      );

      expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
    });
  });

  describe('Computed values reactivity', () => {
    it('should recompute timelineData when checkboxes change', async () => {
      const user = userEvent.setup();

      const ReactivityTestComponent = () => {
        const { toggleVal, timelineData } = useContext(FilterContext);

        return (
          <div>
            <div data-testid="row-count">{timelineData?.data?.rowData?.length || 0}</div>
            <button onClick={() => toggleVal('CBC: Hemoglobin')}>Toggle Hemoglobin</button>
            <button onClick={() => toggleVal('CBC: WBC')}>Toggle WBC</button>
          </div>
        );
      };

      render(
        <FilterProvider roots={mockRoots} isLoading={false}>
          <ReactivityTestComponent />
        </FilterProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('row-count')).toHaveTextContent('3');
      });

      await user.click(screen.getByRole('button', { name: /toggle hemoglobin/i }));

      await waitFor(() => {
        expect(screen.getByTestId('row-count')).toHaveTextContent('1');
      });

      await user.click(screen.getByRole('button', { name: /toggle wbc/i }));

      await waitFor(() => {
        expect(screen.getByTestId('row-count')).toHaveTextContent('2');
      });
    });

    it('should recompute filteredResultsCount when selections change', async () => {
      const user = userEvent.setup();

      const CountTestComponent = () => {
        const { toggleVal, filteredResultsCount } = useContext(FilterContext);

        return (
          <div>
            <div data-testid="filtered-count">{filteredResultsCount}</div>
            <button onClick={() => toggleVal('CBC: Hemoglobin')}>Toggle Hemoglobin</button>
            <button onClick={() => toggleVal('Lipid: Cholesterol')}>Toggle Cholesterol</button>
          </div>
        );
      };

      render(
        <FilterProvider roots={mockRoots} isLoading={false}>
          <CountTestComponent />
        </FilterProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('filtered-count')).toHaveTextContent('4');
      });

      await user.click(screen.getByRole('button', { name: /toggle hemoglobin/i }));

      await waitFor(() => {
        expect(screen.getByTestId('filtered-count')).toHaveTextContent('2');
      });

      await user.click(screen.getByRole('button', { name: /toggle cholesterol/i }));

      await waitFor(() => {
        expect(screen.getByTestId('filtered-count')).toHaveTextContent('3');
      });
    });
  });
});

const rangeTestUuid = '4881482b-0cc7-4201-8ce9-39f00e1fd5a4';
const rangeLowerUuid = 'c0eb98e9-dae8-4b82-8b11-20d87c63eac1';
const rangeUpperUuid = '6ae28db0-135b-4443-a330-e9b4ea45f6c2';

const rangeTestConcept: RangeResultConcept = {
  uuid: rangeTestUuid,
  datatype: { display: 'N/A', hl7Abbreviation: 'ZZ' },
  setMembers: [
    { uuid: rangeLowerUuid, datatype: { display: 'Numeric', hl7Abbreviation: 'NM' } },
    { uuid: rangeUpperUuid, datatype: { display: 'Numeric', hl7Abbreviation: 'NM' } },
  ],
};

// Shaped like augmented /obstree data: obstree does not tag nested sets with their conceptUuid
const buildRangeRoots = (earlierObsDatetime = '2024-01-01T10:00:00.000Z'): Array<TreeNode> => [
  {
    display: 'Tests Orderability',
    flatName: 'Tests Orderability',
    conceptUuid: '1748a953-d12e-4be1-914c-f6b096c6cdef',
    hasData: true,
    subSets: [
      {
        display: 'Range Test',
        flatName: 'Tests Orderability-Range Test',
        hasData: true,
        subSets: [
          {
            display: 'Range Test Lower',
            flatName: 'Tests Orderability-Range Test-Range Test Lower',
            conceptUuid: rangeLowerUuid,
            datatype: 'Numeric',
            units: 'mg/dL',
            lowNormal: 90,
            hiNormal: 110,
            range: '90 – 110 mg/dL',
            hasData: true,
            obs: [
              {
                obsDatetime: '2024-02-01T10:00:00.000Z',
                value: '100',
                interpretation: 'NORMAL',
                range: '90 – 110 mg/dL',
              },
              { obsDatetime: earlierObsDatetime, value: '80', interpretation: 'LOW', range: '90 – 110 mg/dL' },
            ],
          },
          {
            display: 'Range Test Upper',
            flatName: 'Tests Orderability-Range Test-Range Test Upper',
            conceptUuid: rangeUpperUuid,
            datatype: 'Numeric',
            units: 'mg/dL',
            lowNormal: 100,
            hiNormal: 115,
            range: '100 – 115 mg/dL',
            hasData: true,
            obs: [
              {
                obsDatetime: '2024-02-01T10:00:00.000Z',
                value: '120',
                interpretation: 'CRITICALLY_HIGH',
                range: '100 – 115 mg/dL',
              },
            ],
          },
        ],
      },
      {
        display: 'Blood pressure',
        flatName: 'Tests Orderability-Blood pressure',
        hasData: true,
        subSets: [
          {
            display: 'Systolic',
            flatName: 'Tests Orderability-Blood pressure-Systolic',
            conceptUuid: '5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            hasData: true,
            obs: [{ obsDatetime: '2024-02-01T10:00:00.000Z', value: '120', interpretation: 'NORMAL' }],
          },
          {
            display: 'Diastolic',
            flatName: 'Tests Orderability-Blood pressure-Diastolic',
            conceptUuid: '5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            hasData: true,
            obs: [{ obsDatetime: '2024-02-01T10:00:00.000Z', value: '80', interpretation: 'NORMAL' }],
          },
        ],
      },
    ],
  },
];

describe('mergeRangeResults', () => {
  it('collapses a nested range test into one leaf, recognised by its members', () => {
    const [root] = mergeRangeResults(buildRangeRoots(), [rangeTestUuid], [rangeTestConcept]);
    const [rangeTest, bloodPressure] = root.subSets;

    expect(rangeTest).toEqual(
      expect.objectContaining({
        display: 'Range Test',
        flatName: 'Tests Orderability-Range Test',
        conceptUuid: rangeTestUuid,
        units: 'mg/dL',
        range: '90 – 110 mg/dL',
        lowNormal: 90,
        hiNormal: 110,
        isRangeResult: true,
      }),
    );
    expect(rangeTest.subSets).toBeUndefined();
    expect(rangeTest.obs).toEqual([
      expect.objectContaining({
        obsDatetime: '2024-02-01T10:00:00.000Z',
        value: '100 – 120',
        interpretation: 'CRITICALLY_HIGH',
        range: '90 – 110 mg/dL',
      }),
      expect.objectContaining({
        obsDatetime: '2024-01-01T10:00:00.000Z',
        value: '80 – ?',
        interpretation: 'LOW',
        range: '90 – 110 mg/dL',
      }),
    ]);
    // A two-member panel that is not configured as a range test is left alone
    expect(bloodPressure).toEqual(buildRangeRoots()[0].subSets[1]);
  });

  it('takes the Lower and Upper bounds in concept set order rather than the order of the data', () => {
    const roots = buildRangeRoots();
    roots[0].subSets[0].subSets.reverse();

    const [root] = mergeRangeResults(roots, [rangeTestUuid], [rangeTestConcept]);

    expect(root.subSets[0].obs[0].value).toBe('100 – 120');
  });

  it('keeps a range test requested as a root as the heading of its single merged row', () => {
    const rangeRoot: TreeNode = {
      ...buildRangeRoots()[0].subSets[0],
      flatName: 'Range Test',
      conceptUuid: rangeTestUuid,
    };

    // Without the concept definitions, the configured root uuid and the obstree member order are used
    const [root] = mergeRangeResults([rangeRoot], [rangeTestUuid], []);

    expect(root.display).toBe('Range Test');
    expect(root.subSets).toHaveLength(1);
    expect(root.subSets[0]).toEqual(
      expect.objectContaining({ display: 'Range Test', flatName: 'Range Test-Range Test', conceptUuid: rangeTestUuid }),
    );
    expect(root.subSets[0].obs.map((ob) => ob.value)).toEqual(['100 – 120', '80 – ?']);
  });

  it('returns the roots untouched when no range tests are configured', () => {
    const roots = buildRangeRoots();

    expect(mergeRangeResults(roots, [], [rangeTestConcept])).toBe(roots);
  });
});

describe('FilterProvider with range tests', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({ rangeResultConcepts: [rangeTestUuid] } as ConfigObject);
    mockOpenmrsFetch.mockResolvedValue({ data: { results: [rangeTestConcept] } } as any);
  });

  afterEach(() => {
    mockUseConfig.mockReturnValue({} as ConfigObject);
  });

  const RangeConsumer = () => {
    const { timelineData, tableData, totalResultsCount } = useContext(FilterContext);
    return (
      <div>
        <div data-testid="total-count">{totalResultsCount}</div>
        <ul data-testid="timeline-rows">
          {timelineData?.data?.rowData?.map((row) => (
            <li key={row.flatName}>
              {row.display}: {row.entries.map((entry) => entry?.value ?? '').join(' | ')}
            </li>
          ))}
        </ul>
        <ul data-testid="table-entries">
          {tableData?.flatMap((group) =>
            group.entries.map((entry) => (
              <li key={`${group.key}-${entry.obsDatetime}-${entry.display}`}>
                {group.key}/{entry.display}: {entry.value} {entry.units} [{entry.interpretation}] ({entry.range})
              </li>
            )),
          )}
        </ul>
      </div>
    );
  };

  it('exposes one row per range test to the timeline and the tables', async () => {
    render(
      <FilterProvider roots={buildRangeRoots()} isLoading={false}>
        <RangeConsumer />
      </FilterProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('total-count')).toHaveTextContent('4'));
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringContaining(`/concept?references=${rangeTestUuid}&v=custom:`),
    );

    const timelineRows = within(screen.getByTestId('timeline-rows'))
      .getAllByRole('listitem')
      .map((row) => row.textContent);
    expect(timelineRows).toEqual(['Range Test: 100 – 120 | 80 – ?', 'Systolic: 120 | ', 'Diastolic: 80 | ']);

    const tableEntries = within(screen.getByTestId('table-entries'))
      .getAllByRole('listitem')
      .map((entry) => entry.textContent);
    expect(tableEntries).toEqual([
      'Range Test/Range Test: 100 – 120 mg/dL [CRITICALLY_HIGH] (90 – 110 mg/dL)',
      'Blood pressure/Systolic: 120  [NORMAL] ()',
      'Blood pressure/Diastolic: 80  [NORMAL] ()',
      'Range Test/Range Test: 80 – ? mg/dL [LOW] (90 – 110 mg/dL)',
    ]);
  });

  it('renders a range test as one timeline row with one cell per date', async () => {
    // Both results on one day, so the timeline renders the Range Test panel once
    render(
      <FilterProvider roots={buildRangeRoots('2024-02-01T08:00:00.000Z')} isLoading={false}>
        <GroupedTimeline patientUuid="patient-uuid" />
      </FilterProvider>,
    );

    expect(await screen.findByText('100 – 120')).toBeInTheDocument();
    expect(screen.getByText('80 – ?')).toBeInTheDocument();
    expect(screen.getByText('Range Test', { selector: '[class*="trendline-link-view"]' })).toBeInTheDocument();
    expect(screen.getByText('90 – 110 mg/dL')).toBeInTheDocument();
    expect(screen.queryByText('Range Test Lower')).not.toBeInTheDocument();
    expect(screen.queryByText('Range Test Upper')).not.toBeInTheDocument();
    expect(screen.getByText('Systolic')).toBeInTheDocument();
    expect(screen.getByText('Diastolic')).toBeInTheDocument();
  });

  it('leaves the bounds as separate rows when the range test is not configured', async () => {
    mockUseConfig.mockReturnValue({ rangeResultConcepts: [] } as ConfigObject);

    render(
      <FilterProvider roots={buildRangeRoots()} isLoading={false}>
        <RangeConsumer />
      </FilterProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('total-count')).toHaveTextContent('5'));
    const timelineRows = within(screen.getByTestId('timeline-rows'))
      .getAllByRole('listitem')
      .map((row) => row.textContent);
    expect(timelineRows).toEqual([
      'Range Test Lower: 100 | 80',
      'Range Test Upper: 120 | ',
      'Systolic: 120 | ',
      'Diastolic: 80 | ',
    ]);
  });
});
