import { Request, Response } from 'express';

const URL_REGEX = /^https?:\/\/(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?$/;
const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
const FETCH_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 60 * 60 * 1000;

const previewCache = new Map<string, { data: Record<string, unknown>; expires: number }>();

function extractOgMeta(html: string): { title?: string; description?: string; image?: string; siteName?: string } {
  const result: { title?: string; description?: string; image?: string; siteName?: string } = {};
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  if (ogTitle) result.title = ogTitle[1].trim().slice(0, 200);

  const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
  if (ogDesc) result.description = ogDesc[1].trim().slice(0, 300);

  const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (ogImage) result.image = ogImage[1].trim();

  const ogSiteName = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i);
  if (ogSiteName) result.siteName = ogSiteName[1].trim().slice(0, 100);

  if (!result.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) result.title = titleMatch[1].trim().slice(0, 200);
  }

  return result;
}

function isUrlSafe(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (BLOCKED_HOSTS.includes(host)) return false;
    if (host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.')) return false;
    return true;
  } catch {
    return false;
  }
}

export async function getLinkPreview(req: Request, res: Response): Promise<void> {
  const url = req.query.url as string;
  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  const trimmed = url.trim().replace(/\*+$/, '');
  if (!trimmed || !URL_REGEX.test(trimmed) || !isUrlSafe(trimmed)) {
    res.status(400).json({ error: 'Invalid or unsafe URL' });
    return;
  }

  const cached = previewCache.get(trimmed);
  if (cached && cached.expires > Date.now()) {
    res.json({ data: cached.data });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(trimmed, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Camp-Bot/1.0 (Link Preview)' },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!response.ok) {
      res.status(502).json({ error: 'Failed to fetch URL' });
      return;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      res.status(400).json({ error: 'URL does not point to HTML' });
      return;
    }

    const html = await response.text();
    const preview = extractOgMeta(html);

    if (!preview.title && !preview.description && !preview.image) {
      res.status(404).json({ error: 'No preview data found' });
      return;
    }

    previewCache.set(trimmed, { data: preview, expires: Date.now() + CACHE_TTL_MS });
    res.json({ data: preview });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      res.status(504).json({ error: 'Request timeout' });
      return;
    }
    res.status(502).json({ error: 'Failed to fetch URL' });
  }
}
