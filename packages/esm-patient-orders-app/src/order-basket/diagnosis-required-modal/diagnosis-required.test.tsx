import React from 'react';
import { vi, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DiagnosisRequiredModal from './diagnosis-required.modal';

describe('DiagnosisRequiredModal', () => {
  it('asks for a diagnosis and closes on OK', async () => {
    const user = userEvent.setup();
    const closeModal = vi.fn();
    render(<DiagnosisRequiredModal closeModal={closeModal} />);

    expect(screen.getByText('Diagnosis required')).toBeInTheDocument();
    expect(screen.getByText(/please add a diagnosis first/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /ok/i }));
    expect(closeModal).toHaveBeenCalled();
  });
});
