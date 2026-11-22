import { INTENSITY_LABELS, MOODS } from '../lib/moods';
import { Flower } from './Flower';

interface MoodPickerProps {
  mood: string | null;
  onMoodChange: (mood: string | null) => void;
  intensity?: number | null;
  onIntensityChange?: (value: number | null) => void;
  compact?: boolean;
}

export function MoodPicker({ mood, onMoodChange, intensity, onIntensityChange, compact }: MoodPickerProps) {
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="label">There is no right way to feel</legend>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Feelings">
          {MOODS.map((m) => {
            const selected = mood === m.label;
            return (
              <button
                key={m.label}
                type="button"
                aria-pressed={selected}
                className="chip chip-toggle"
                onClick={() => onMoodChange(selected ? null : m.label)}
              >
                <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full" style={{ background: m.color }} />
                {compact ? m.label.replace(' / prefer not to say', '') : m.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {onIntensityChange && mood && (
        <fieldset>
          <legend className="label">How strongly? (optional)</legend>
          <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Intensity">
            {INTENSITY_LABELS.map((label, i) => {
              const value = i + 1;
              const selected = intensity === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${value} of 5, ${label}`}
                  title={label}
                  onClick={() => onIntensityChange(selected ? null : value)}
                  className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${selected ? 'border-accent bg-rose/30' : 'border-line hover:border-accent'}`}
                >
                  <Flower color={MOODS.find((m) => m.label === mood)?.color ?? '#BDB2A2'} intensity={value} size={26} />
                </button>
              );
            })}
            {intensity && <span className="text-sm text-muted">{INTENSITY_LABELS[intensity - 1]}</span>}
          </div>
        </fieldset>
      )}
    </div>
  );
}
