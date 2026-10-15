import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { type Obs, useConfig } from '@openmrs/esm-framework';
import { type ChartConfig } from '../../../config-schema';
import EncounterObservations from './encounter-observations.component';

const mockUseConfig = vi.mocked(useConfig<ChartConfig>);

const rangeTestUuid = '4881482b-0cc7-4201-8ce9-39f00e1fd5a4';

const member = (conceptUuid: string, display: string, value: number, units?: string) =>
  ({
    uuid: `${conceptUuid}-obs`,
    concept: { uuid: conceptUuid, display, units },
    value,
    display: `${display}: ${value}.0`,
  }) as unknown as Obs;

const rangeObs = (groupMembers: Array<Obs>) =>
  ({
    uuid: 'range-obs',
    concept: { uuid: rangeTestUuid, display: 'Range Test' },
    display: 'Range Test: 100.0, 120.0',
    groupMembers,
  }) as unknown as Obs;

const bloodPressureObs = {
  uuid: 'bp-obs',
  concept: { uuid: 'blood-pressure-uuid', display: 'Blood pressure' },
  display: 'Blood pressure: 120.0, 80.0',
  groupMembers: [member('systolic-uuid', 'Systolic', 120), member('diastolic-uuid', 'Diastolic', 80)],
} as unknown as Obs;

describe('EncounterObservations', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({ obsConceptUuidsToHide: [], rangeResultConcepts: [rangeTestUuid] } as ChartConfig);
  });

  it('shows a range test as one line with its lower and upper bounds', () => {
    render(
      <EncounterObservations
        observations={[
          rangeObs([
            member('lower-uuid', 'Range Test Lower', 100, 'mg/dL'),
            member('upper-uuid', 'Range Test Upper', 120),
          ]),
        ]}
      />,
    );

    expect(screen.getByText('Range Test')).toBeInTheDocument();
    expect(screen.getByText('100 – 120 mg/dL')).toBeInTheDocument();
    expect(screen.queryByText('Range Test Lower')).not.toBeInTheDocument();
    expect(screen.queryByText('Range Test Upper')).not.toBeInTheDocument();
  });

  it('shows a range test without units when its bounds have none', () => {
    render(
      <EncounterObservations
        observations={[
          rangeObs([member('lower-uuid', 'Range Test Lower', 100), member('upper-uuid', 'Range Test Upper', 120)]),
        ]}
      />,
    );

    expect(screen.getByText('100 – 120')).toBeInTheDocument();
  });

  it('shows a two-member group that is not a configured range test as a group', () => {
    render(<EncounterObservations observations={[bloodPressureObs]} />);

    expect(screen.getByText('Blood pressure')).toBeInTheDocument();
    expect(screen.getByText('Systolic')).toBeInTheDocument();
    expect(screen.getByText('120.0')).toBeInTheDocument();
    expect(screen.getByText('Diastolic')).toBeInTheDocument();
    expect(screen.getByText('80.0')).toBeInTheDocument();
  });

  it('shows the range test members as a group when range tests are not configured', () => {
    mockUseConfig.mockReturnValue({ obsConceptUuidsToHide: [], rangeResultConcepts: [] } as ChartConfig);

    render(
      <EncounterObservations
        observations={[
          rangeObs([member('lower-uuid', 'Range Test Lower', 100), member('upper-uuid', 'Range Test Upper', 120)]),
        ]}
      />,
    );

    expect(screen.getByText('Range Test Lower')).toBeInTheDocument();
    expect(screen.getByText('Range Test Upper')).toBeInTheDocument();
    expect(screen.queryByText('100 – 120')).not.toBeInTheDocument();
  });
});
