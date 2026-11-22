interface PinInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (digits: string) => void;
  description?: string;
  describedBy?: string;
}

const MASK = '\u2022';

/**
 * A 6-digit PIN field that browsers and password managers will not offer to save or autofill:
 * it is a plain text input (not type="password") that displays bullets, and it opts out of autofill.
 */
export function PinInput({ id, label, value, onChange, description, describedBy }: PinInputProps) {
  const handle = (raw: string) => {
    if (raw.length < value.length) {
      onChange(value.slice(0, raw.length));
      return;
    }
    const typed = raw.replaceAll(MASK, '').replace(/\D/g, '');
    onChange((value + typed).slice(0, 6));
  };

  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input
        id={id}
        name={`${id}-code`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        maxLength={12}
        className="field tracking-[0.4em]"
        value={MASK.repeat(value.length)}
        onChange={(e) => handle(e.target.value)}
        aria-describedby={describedBy ?? (description ? `${id}-help` : undefined)}
        data-lpignore="true"
        data-1p-ignore="true"
        data-bwignore="true"
        data-form-type="other"
      />
      {description && (
        <p id={`${id}-help`} className="mt-1 text-sm text-muted">
          {description}
        </p>
      )}
    </div>
  );
}
