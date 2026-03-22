import { useState, useEffect } from 'react';

interface PreviewData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

const previewCache = new Map<string, PreviewData | null>();

function getSiteNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    return host.split('.')[0].charAt(0).toUpperCase() + host.split('.')[0].slice(1);
  } catch {
    return 'Link';
  }
}

interface Props {
  url: string;
  className?: string;
}

export default function LinkPreview({ url, className = '' }: Props) {
  const [preview, setPreview] = useState<PreviewData | null>(
    () => previewCache.get(url) ?? null
  );
  const [loading, setLoading] = useState(!previewCache.has(url));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (previewCache.has(url)) {
      const cached = previewCache.get(url);
      setPreview(cached ?? null);
      setLoading(false);
      setError(cached === null);
      return;
    }

    const BASE = import.meta.env.VITE_API_URL || '/api';
    const encoded = encodeURIComponent(url);

    fetch(`${BASE.replace(/\/$/, '')}/link-preview?url=${encoded}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch preview');
        return res.json();
      })
      .then((data) => {
        const p = data.data;
        if (p && (p.title || p.description || p.image)) {
          previewCache.set(url, p);
          setPreview(p);
        } else {
          previewCache.set(url, null);
          setError(true);
        }
      })
      .catch(() => {
        previewCache.set(url, null);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [url]);

  if (loading || error || !preview) return null;

  const siteName = preview.siteName || getSiteNameFromUrl(url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block mt-2 rounded overflow-hidden border border-layer-5 hover:border-layer-6 transition-colors max-w-[400px] ${className}`}
    >
      <div className="flex bg-layer-2 rounded border-l-4 border-l-accent-500">
        <div className="flex-1 min-w-0 p-3">
          <p className="text-[#80848E] text-xs truncate mb-0.5">{siteName}</p>
          {preview.title && (
            <p className="text-accent-400 font-medium text-sm truncate hover:underline">
              {preview.title}
            </p>
          )}
          {preview.description && (
            <p className="text-[#80848E] text-xs line-clamp-2 mt-1">{preview.description}</p>
          )}
        </div>
        {preview.image && (
          <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24">
            <img
              src={preview.image}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.parentElement!.style.display = 'none';
              }}
            />
          </div>
        )}
      </div>
    </a>
  );
}
