/** Plain-text preview of Markdown for cards and lists. */
export function excerpt(markdown: string, max = 140): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~]/g, '')
    .replace(/^\s*[-+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? `${plain.slice(0, max).trimEnd()}...` : plain;
}

export function entryTitle(entry: { title: string | null; body: string }): string {
  return entry.title?.trim() || excerpt(entry.body, 48) || 'Untitled page';
}
