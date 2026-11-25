import { useEffect, useState } from 'react';
import { serverApi } from '../../services/api/server.api';

export interface InvitePreviewData {
  name: string;
  icon: string;
  banner: string;
  memberCount: number;
  onlineCount: number;
}

/** Pulls the invite code out of a "from" path like /invite/AbC123. */
export function inviteCodeFrom(path?: string | null): string | null {
  const m = path?.match(/^\/invite\/([a-zA-Z0-9]+)\/?$/);
  return m ? m[1] : null;
}

/** Public preview of the server an invite points at; null while loading or when invalid. */
export function useInvitePreview(code: string | null) {
  const [preview, setPreview] = useState<InvitePreviewData | null>(null);
  useEffect(() => {
    if (!code) return;
    let alive = true;
    serverApi
      .getInvitePreview(code)
      .then((p) => alive && setPreview(p))
      .catch(() => alive && setPreview(null));
    return () => {
      alive = false;
    };
  }, [code]);
  return preview;
}

/** The server you are about to join, shown on the plate so the invite never gets lost. */
export function InviteStrip({ preview }: { preview: InvitePreviewData }) {
  return (
    <div className="mb-8 flex items-center gap-4 border-y-[1.5px] border-fg py-3">
      <div className="w-11 h-11 shrink-0 bg-primary text-on-primary flex items-center justify-center overflow-hidden rounded-[2px]">
        {preview.icon ? (
          <img src={preview.icon} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="font-semibold text-lg">{preview.name.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-fg-3">You were invited to join</p>
        <p className="font-semibold text-fg truncate">{preview.name}</p>
      </div>
      <dl className="ml-auto flex gap-4 text-sm text-fg shrink-0">
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true" className="block w-2.5 h-2.5 rounded-full bg-online ring-1 ring-fg" />
          <dt className="sr-only">Online</dt>
          <dd className="tabular-nums">{preview.onlineCount.toLocaleString()} online</dd>
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          <span aria-hidden="true" className="block w-2.5 h-2.5 rounded-full border border-dashed border-fg" />
          <dt className="sr-only">Members</dt>
          <dd className="tabular-nums">{preview.memberCount.toLocaleString()} members</dd>
        </div>
      </dl>
    </div>
  );
}
