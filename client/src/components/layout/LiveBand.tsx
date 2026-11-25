import { useEffect, useMemo } from 'react';
import { useActivityStore, type ActivityEvent } from '../../stores/useActivityStore';
import { useServerStore } from '../../stores/useServerStore';
import { useVoiceStore } from '../../stores/useVoiceStore';
import { identityColor } from '../../utils/identity';

const VERB: Record<ActivityEvent['kind'], (place?: string) => string> = {
  online: () => 'came online',
  idle: () => 'went idle',
  offline: () => 'went offline',
  'voice-join': (p) => `joined ${p ?? 'voice'}`,
  'voice-leave': (p) => `left ${p ?? 'voice'}`,
  message: (p) => `posted in #${p ?? 'a channel'}`,
  join: () => 'joined the server',
};

/** A strip of pixels that dissolves into the band's ends, drawn once as SVG. */
function PixelEdge({ side }: { side: 'left' | 'right' }) {
  const cells: { x: number; y: number; o: number }[] = [];
  // 6 columns x 8 rows of 4px cells, denser toward the band
  for (let c = 0; c < 6; c++) {
    for (let r = 0; r < 8; r++) {
      const density = side === 'right' ? c / 5 : 1 - c / 5;
      const h = Math.abs(Math.sin((c + 1) * 12.9898 + (r + 1) * 78.233) * 43758.5453) % 1;
      if (h < density * 0.75) cells.push({ x: c * 4, y: r * 4, o: 0.25 + h * 0.4 });
    }
  }
  return (
    <svg aria-hidden="true" width="24" height="32" viewBox="0 0 24 32" className="shrink-0" shapeRendering="crispEdges">
      {cells.map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width="4" height="4" fill="var(--band-fg)" opacity={p.o * 0.35} />
      ))}
    </svg>
  );
}

/**
 * The live band under the channel header: always black, in both themes.
 * It scrolls recent presence, voice and message activity for the open server,
 * and falls back to a quiet summary when nothing has happened yet.
 */
export default function LiveBand() {
  const events = useActivityStore((s) => s.events);
  const members = useServerStore((s) => s.members);
  const currentServer = useServerStore((s) => s.currentServer);
  const voiceStates = useVoiceStore((s) => s.voiceStates);
  const clear = useActivityStore((s) => s.clear);

  // Activity belongs to the open server; start fresh when switching.
  useEffect(() => clear(), [currentServer?._id, clear]);

  const summary = useMemo(() => {
    const online = members.filter((m) => m.status && m.status !== 'offline' && m.status !== 'invisible').length;
    const channelIds = new Set((currentServer?.channels ?? []).map((c) => (typeof c === 'string' ? c : c._id)));
    const inVoice = Object.entries(voiceStates ?? {})
      .filter(([cid]) => channelIds.size === 0 || channelIds.has(cid))
      .reduce((n, [, users]) => n + (users?.length ?? 0), 0);
    return { online, inVoice };
  }, [members, currentServer, voiceStates]);

  const items = events.slice(0, 12);
  const duration = Math.max(28, items.length * 6);

  return (
    <div
      className="h-8 shrink-0 bg-band text-band-fg flex items-center overflow-hidden border-b border-band-2 select-none"
      role="status"
      aria-live="polite"
      aria-label="Live activity"
    >
      <span className="flex items-center gap-2 pl-4 pr-3 h-full shrink-0">
        <span aria-hidden="true" className="block w-1.5 h-1.5 bg-danger-500 animate-[live-blink_1.6s_steps(2,end)_infinite] motion-reduce:animate-none" />
        <span className="text-[11px] font-bold tracking-[0.14em] leading-none">LIVE</span>
      </span>
      <PixelEdge side="left" />

      <div className="relative flex-1 min-w-0 h-full overflow-hidden group [mask-image:linear-gradient(to_right,transparent,#000_24px,#000_calc(100%-24px),transparent)]">
        {items.length === 0 ? (
          <p className="h-full flex items-center gap-5 px-3 text-[13px] text-band-fg/70 whitespace-nowrap">
            <span>
              <span className="font-semibold tabular-nums text-band-fg">{summary.online}</span> online
            </span>
            <span>
              <span className="font-semibold tabular-nums text-band-fg">{summary.inVoice}</span> in voice
            </span>
            <span className="text-band-fg/50">Activity in this server shows up here as it happens.</span>
          </p>
        ) : (
          <div
            className="absolute inset-y-0 left-0 flex items-center whitespace-nowrap animate-[band-scroll_var(--band-dur)_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none"
            style={{ ['--band-dur' as string]: `${duration}s` }}
          >
            {[0, 1].map((copy) => (
              <ul key={copy} aria-hidden={copy === 1} className="flex items-center gap-8 pr-8 text-[13px]">
                {items.map((e) => (
                  <li key={e.id} className="flex items-center gap-1.5">
                    <span className="font-semibold" style={{ color: identityColor(e.userId, true) }}>
                      {e.name}
                    </span>
                    <span className="text-band-fg/70">{VERB[e.kind](e.place)}</span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        )}
      </div>

      <PixelEdge side="right" />
      <span className="pr-4 pl-2 text-[12px] text-band-fg/60 shrink-0 tabular-nums">
        <span className="font-semibold tabular-nums text-band-fg">{summary.online}</span> online
      </span>
    </div>
  );
}
