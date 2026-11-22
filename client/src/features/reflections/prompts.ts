import { dayOfYear } from '../../lib/dates';

export const DAILY_PROMPTS = [
  'What moment from today do I want to remember?',
  'What felt heavier than I expected?',
  'What gave me a little energy?',
  'What did I need today?',
  'What am I proud of, even if it seems small?',
  'Is there something I want to let go of?',
  'What would I tell a friend who felt the way I do?',
  'What stayed with you today?',
  'What made me smile, even briefly?',
  'What am I looking forward to?',
  'Who or what made today feel a little lighter?',
  'What do I want to be gentler with myself about?',
];

export const promptForDay = (date = new Date()) => DAILY_PROMPTS[dayOfYear(date) % DAILY_PROMPTS.length]!;

export const WEEKLY_QUESTIONS = [
  'What stood out to me this week?',
  'What gave me energy, and what drained it?',
  'What do I want to carry into next week?',
];

export const MONTHLY_QUESTIONS = [
  'What moments from this month do I want to keep?',
  'What patterns did I notice in how I felt?',
  'What am I grateful for?',
  'What would I like more of next month?',
];

export const LEARNED_QUESTIONS = ['What did I learn recently?', 'How might that change what I do next?'];
export const CARRYING_QUESTIONS = ['What am I carrying with me right now?', 'What would feel good to set down, even for a moment?'];

export const REFLECTION_LABELS: Record<string, string> = {
  daily: 'Daily prompt',
  weekly: 'Weekly reflection',
  monthly: 'Monthly reflection',
  'future-letter': 'Letter to my future self',
  learned: 'What did I learn?',
  carrying: 'What am I carrying?',
  custom: 'Reflection',
};
