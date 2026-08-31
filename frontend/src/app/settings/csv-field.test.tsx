import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CsvField } from './page';

/**
 * CsvField backs the MTTR "Incident Priorities" input (feature 0027) and its
 * three siblings. The non-trivial logic is the draft→commit CSV round-trip:
 * the user types freely, and the parent only receives a parsed array on blur.
 */
describe('CsvField (Incident Priorities input)', () => {
  it('renders the current priorities joined as CSV', () => {
    render(
      <CsvField label="Incident Priorities" value={['Critical', 'High']} onChange={() => {}} />,
    );
    expect(screen.getByLabelText('Incident Priorities')).toHaveValue('Critical, High');
  });

  it('commits a trimmed, non-empty array on blur', () => {
    const onChange = vi.fn();
    render(<CsvField label="Incident Priorities" value={['Critical']} onChange={onChange} />);

    const input = screen.getByLabelText('Incident Priorities');
    fireEvent.change(input, { target: { value: ' High , , Highest ' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(['High', 'Highest']);
  });

  it('commits an empty array when cleared (empty = all priorities qualify)', () => {
    const onChange = vi.fn();
    render(<CsvField label="Incident Priorities" value={['Critical']} onChange={onChange} />);

    const input = screen.getByLabelText('Incident Priorities');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith([]);
  });
});
