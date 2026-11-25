interface Props {
  message?: string;
}

export default function AppLoader({ message }: Props) {
  return (
    <div
      className="fixed inset-0 h-full min-h-dvh w-full overflow-hidden bg-fg flex flex-col items-center justify-center gap-5"
      role="status"
      aria-live="polite"
      aria-label={message || 'Loading'}
    >
      <div className="flex items-center gap-3.5" aria-hidden="true">
        <span className="block w-px h-12 bg-fg" />
        <span className="block w-7 h-[7px] border-y-2 border-tick-now animate-pulse motion-reduce:animate-none" />
        <span className="font-pixel text-[22px] leading-none tracking-[0.06em] text-fg">CAMP</span>
      </div>
      {message && <p className="text-fg-4 text-sm">{message}</p>}
    </div>
  );
}
