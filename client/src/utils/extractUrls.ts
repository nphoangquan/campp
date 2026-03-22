const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

function normalizeUrl(url: string): string | null {
  try {
    const cleaned = url.replace(/\*+$/, '').trim();
    if (!cleaned) return null;
    const parsed = new URL(cleaned);
    if (!parsed.hostname || parsed.hostname.length < 4) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function extractUrls(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  const seen = new Set<string>();
  return matches.filter((url) => {
    const normalized = normalizeUrl(url);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
