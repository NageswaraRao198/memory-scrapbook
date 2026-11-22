import { useState, type KeyboardEvent } from 'react';
import { Icon } from './Icon';

interface TagInputProps {
  id: string;
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  max?: number;
}

export function TagInput({ id, label, value, onChange, suggestions = [], placeholder = 'Type and press Enter', max = 12 }: TagInputProps) {
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const tag = raw.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!tag || value.length >= max) return;
    if (value.some((v) => v.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
      setDraft('');
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const unused = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase())).slice(0, 8);

  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-line bg-surface p-2">
        {value.map((tag) => (
          <span key={tag} className="chip">
            {tag}
            <button type="button" aria-label={`Remove ${tag}`} className="text-muted hover:text-ink" onClick={() => onChange(value.filter((v) => v !== tag))}>
              <Icon name="x" size={12} />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            add(draft);
            setDraft('');
          }}
          placeholder={value.length ? '' : placeholder}
          className="min-h-[32px] min-w-[8rem] flex-1 bg-transparent px-1 outline-none"
          maxLength={40}
        />
      </div>
      {unused.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label={`${label} suggestions`}>
          {unused.map((s) => (
            <button key={s} type="button" className="chip chip-toggle" aria-pressed="false" onClick={() => add(s)}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
