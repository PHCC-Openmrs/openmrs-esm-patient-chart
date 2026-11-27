import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { configSchema, type ConfigObject } from '../config-schema';
import { createOrUpdateNursingEncounter, useNursingEncounter } from '../common';
import { type NursingFormSection } from '../constants';
import NursingForm from './nursing-form.workspace';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseNursingEncounter = vi.mocked(useNursingEncounter);
const mockCreateOrUpdateNursingEncounter = vi.mocked(createOrUpdateNursingEncounter);

vi.mock('../common', async () => ({
  ...((await vi.importActual('../common')) as object),
  createOrUpdateNursingEncounter: vi.fn(),
  uploadEcgAttachment: vi.fn(),
  useConceptAnswers: vi.fn(() => ({ answers: [], isLoading: false })),
  useOintmentAnswers: vi.fn(() => ({ answers: [], isLoading: false })),
  useNursingEncounter: vi.fn(),
  useInvalidateNursingRecords: vi.fn(() => vi.fn()),
}));

vi.mock('@openmrs/esm-patient-common-lib', () => ({
  useOptimisticVisitMutations: () => ({ invalidateVisitRelatedData: vi.fn() }),
}));

const config = getDefaultsFromConfigSchema(configSchema) as ConfigObject;

function mockEncounter(initialValues: Record<string, string | number | Array<string>>) {
  const existingObsByField = new Map(Object.keys(initialValues).map((field) => [field, { uuid: `${field}-obs-uuid` }]));
  mockUseNursingEncounter.mockReturnValue({
    existingObsByField,
    existingOintmentObs: [],
    getInitialValues: () => initialValues,
    isLoading: false,
    mutate: vi.fn(),
  } as unknown as ReturnType<typeof useNursingEncounter>);
}

function renderForm(section?: NursingFormSection, formContext: 'creating' | 'editing' = 'creating') {
  const props = {
    closeWorkspace: vi.fn(),
    workspaceProps: {
      formContext,
      section,
      editEncounterUuid: formContext === 'editing' ? 'encounter-uuid' : undefined,
    },
    groupProps: { patientUuid: 'patient-uuid' },
  };
  return render(<NursingForm {...(props as unknown as React.ComponentProps<typeof NursingForm>)} />);
}

beforeEach(() => {
  mockUseConfig.mockReturnValue(config);
  mockEncounter({});
});

describe('NursingForm', () => {
  it('shows only Dressing and Other Measures when opened from that card', () => {
    renderForm('dressing');

    expect(screen.getByRole('heading', { name: 'Record dressing and other measures' })).toBeInTheDocument();
    expect(screen.getByText('Dressing')).toBeInTheDocument();
    expect(screen.getByText('Other Measures')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /type of wound/i })).toBeInTheDocument();
    expect(screen.queryByText('Nursing Procedures')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /im injection/i })).not.toBeInTheDocument();
  });

  it('shows only Nursing Procedures when opened from that card', () => {
    renderForm('procedures');

    expect(screen.getByRole('heading', { name: 'Record nursing procedures' })).toBeInTheDocument();
    expect(screen.getByText('Nursing Procedures')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /im injection/i })).toBeInTheDocument();
    expect(screen.queryByText('Dressing')).not.toBeInTheDocument();
    expect(screen.queryByText('Other Measures')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /type of wound/i })).not.toBeInTheDocument();
  });

  it('shows every section when no section is given', () => {
    renderForm();

    expect(screen.getByRole('heading', { name: 'Record nursing' })).toBeInTheDocument();
    expect(screen.getByText('Dressing')).toBeInTheDocument();
    expect(screen.getByText('Other Measures')).toBeInTheDocument();
    expect(screen.getByText('Nursing Procedures')).toBeInTheDocument();
  });

  it('titles the edit form after the section being edited', () => {
    renderForm('procedures', 'editing');

    expect(screen.getByRole('heading', { name: 'Edit nursing procedures' })).toBeInTheDocument();
  });

  it('leaves the hidden procedures untouched when editing the dressing', async () => {
    const user = userEvent.setup();
    mockEncounter({ typeOfWound: 'Abrasion', imInjectionDrug: 'drug-uuid', imInjectionQty: 2 });
    renderForm('dressing', 'editing');

    const typeOfWound = screen.getByRole('textbox', { name: /type of wound/i });
    await user.clear(typeOfWound);
    await user.type(typeOfWound, 'Laceration');
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    expect(mockCreateOrUpdateNursingEncounter).toHaveBeenCalledTimes(1);
    const obs = mockCreateOrUpdateNursingEncounter.mock.calls[0][4];
    expect(obs).toEqual([
      { concept: config.concepts.typeOfWoundUuid, value: 'Laceration' },
      { uuid: 'typeOfWound-obs-uuid', voided: true },
    ]);
  });

  it('explains why it cannot save when a hidden procedure is incomplete', async () => {
    const user = userEvent.setup();
    mockEncounter({ typeOfWound: 'Abrasion', imInjectionDrug: 'drug-uuid' });
    renderForm('dressing', 'editing');

    await user.type(screen.getByRole('textbox', { name: /type of wound/i }), ' wound');
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    expect(await screen.findByText(/fix it from the nursing procedures card first/i)).toBeInTheDocument();
    expect(mockCreateOrUpdateNursingEncounter).not.toHaveBeenCalled();
  });
});
