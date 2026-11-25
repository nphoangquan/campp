interface Props {
  status?: string;
  /** Colour of the ring that separates the dot from the avatar; match the surface behind it. */
  ringClass?: string;
  className?: string;
}

const LABEL: Record<string, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do not disturb',
  offline: 'Offline',
  invisible: 'Offline',
};

/**
 * Presence by shape as well as colour: a filled dot for online, a hollow ring for
 * idle, a filled dot with a bar for do-not-disturb, and a grey ring for offline.
 */
export default function StatusDot({ status = 'offline', ringClass = 'ring-surface', className = '' }: Props) {
  const s = status === 'invisible' ? 'offline' : status;
  const base = `block w-3 h-3 rounded-full ring-[2.5px] ${ringClass} ${className}`;
  const label = LABEL[s] ?? 'Offline';
  if (s === 'online') return <span role="img" aria-label={label} className={`${base} bg-online`} />;
  if (s === 'idle') return <span role="img" aria-label={label} className={`${base} bg-surface border-[3px] border-idle`} />;
  if (s === 'dnd')
    return (
      <span role="img" aria-label={label} className={`${base} bg-dnd flex items-center justify-center`}>
        <span className="block w-[6px] h-[2px] bg-white" />
      </span>
    );
  return <span role="img" aria-label={label} className={`${base} bg-surface border-2 border-fg-4`} />;
}
