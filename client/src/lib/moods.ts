export interface MoodOption {
  label: string;
  color: string;
}

/** Muted, non-judgemental palette: no red/green "good versus bad" framing. */
export const MOODS: MoodOption[] = [
  { label: 'Happy', color: '#E0AE55' },
  { label: 'Peaceful', color: '#86A8A0' },
  { label: 'Grateful', color: '#C99591' },
  { label: 'Excited', color: '#D98E5F' },
  { label: 'Content', color: '#A6B088' },
  { label: 'Tired', color: '#AFA595' },
  { label: 'Anxious', color: '#9C8FB3' },
  { label: 'Sad', color: '#7E96AD' },
  { label: 'Frustrated', color: '#B7806A' },
  { label: 'Overwhelmed', color: '#A67B8C' },
  { label: 'Confused', color: '#98A3A8' },
  { label: 'Other / prefer not to say', color: '#BDB2A2' },
];

const FALLBACK = '#BDB2A2';

export function moodColor(label: string | null | undefined): string {
  if (!label) return FALLBACK;
  return MOODS.find((m) => m.label === label)?.color ?? FALLBACK;
}

export const EMOTION_SUGGESTIONS = [
  'calm', 'hopeful', 'lonely', 'proud', 'restless', 'nostalgic', 'loved', 'curious', 'numb', 'relieved', 'tender', 'stuck',
];

export const CONTEXT_SUGGESTIONS = [
  'work', 'family', 'friendship', 'health', 'personal growth', 'love', 'home', 'travel', 'creativity',
];

export const INTENSITY_LABELS = ['Very light', 'Light', 'Moderate', 'Strong', 'Very strong'];
