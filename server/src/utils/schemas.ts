import { z } from 'zod';

const TAG_MAX = 40;

const cleanTag = (t: string) => t.trim().replace(/\s+/g, ' ');

/** Trimmed, de-duplicated (case-insensitive) list of short labels. */
export const tagList = (max = 20) =>
  z
    .array(z.string().max(TAG_MAX * 2))
    .max(max)
    .default([])
    .transform((list) => {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const raw of list) {
        const tag = cleanTag(raw).slice(0, TAG_MAX);
        const key = tag.toLowerCase();
        if (tag && !seen.has(key)) {
          seen.add(key);
          out.push(tag);
        }
      }
      return out;
    });

export const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Must be a valid date')
  .transform((v) => new Date(v).toISOString());

export const intensity = z.number().int().min(1).max(5);

export const idParam = z.object({ id: z.string().uuid() });

export const pageQuery = {
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
};

export const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((v) => v.trim())
    .nullish()
    .transform((v) => (v ? v : null));

export function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === 'string');
  if (typeof value !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export const nowIso = () => new Date().toISOString();
