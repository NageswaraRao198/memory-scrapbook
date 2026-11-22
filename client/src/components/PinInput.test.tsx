import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PinInput } from './PinInput';

function Harness() {
  const [pin, setPin] = useState('');
  return (
    <>
      <PinInput id="pin" label="PIN" value={pin} onChange={setPin} />
      <output data-testid="value">{pin}</output>
    </>
  );
}

describe('PinInput', () => {
  it('keeps only up to 6 digits, masks them, and opts out of browser saving', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('PIN') as HTMLInputElement;

    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('autocomplete', 'off');

    await user.type(input, '12a34-56789');
    expect(screen.getByTestId('value')).toHaveTextContent('123456');
    expect(input.value).toBe('\u2022'.repeat(6));
    expect(input.value).not.toMatch(/\d/);

    await user.type(input, '{Backspace}{Backspace}');
    expect(screen.getByTestId('value')).toHaveTextContent('1234');
  });
});
