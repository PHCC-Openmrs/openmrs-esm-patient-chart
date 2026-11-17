import React from 'react';
import { vi, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { mockPatient } from 'tools';
import { mockDeceasedPatient } from '__mocks__';
import { useCauseOfDeath } from '../hooks/useCauseOfDeath';
import DeceasedPatientBannerTag from './deceased-patient-tag.extension';

vi.mock('../hooks/useCauseOfDeath', () => ({
  useCauseOfDeath: vi.fn(() => ({ causeOfDeath: undefined, nonCodedCauseOfDeath: undefined, error: undefined })),
}));

const mockUseCauseOfDeath = vi.mocked(useCauseOfDeath);

describe('DeceasedPatientTag', () => {
  it('does not render Deceased tag for patients who are still alive', () => {
    const patient = { ...mockPatient, deceasedDateTime: '' };
    render(<DeceasedPatientBannerTag patient={patient} />);
    expect(screen.queryByRole('tooltip', { name: / 04-Apr-1972, 12:00\s+AM/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Deceased/ })).not.toBeInTheDocument();
  });

  it('renders a deceased tag in the patient banner for patients who died', () => {
    render(<DeceasedPatientBannerTag patient={mockDeceasedPatient} />);

    expect(screen.getByRole('tooltip', { name: / 04-Apr-1972, 12:00\s+AM/i }));
    expect(screen.getByRole('button', { name: /Deceased/ })).toBeInTheDocument();
  });

  it('does not fetch a cause of death for a patient who is alive', () => {
    render(<DeceasedPatientBannerTag patient={{ ...mockPatient, deceasedDateTime: '' }} />);

    expect(mockUseCauseOfDeath).toHaveBeenLastCalledWith(null);
  });

  it('fetches the cause of death for a deceased patient', () => {
    render(<DeceasedPatientBannerTag patient={mockDeceasedPatient} />);

    expect(mockUseCauseOfDeath).toHaveBeenLastCalledWith(mockDeceasedPatient.id);
  });
});
