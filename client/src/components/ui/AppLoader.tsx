interface Props {
  message?: string;
}

export default function AppLoader({ message }: Props) {
  return (
    <div
      className="fixed inset-0 h-full min-h-dvh w-full overflow-hidden bg-layer-0 flex flex-col items-center justify-center gap-6"
      role="status"
      aria-live="polite"
      aria-label={message || 'Loading'}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-accent-500 flex items-center justify-center shadow-lg shadow-accent-500/20">
          <span className="text-white text-2xl font-bold">C</span>
        </div>
        <h1 className="text-xl font-semibold text-white tracking-tight">Camp</h1>
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin" />
        {message && <p className="text-[#80848E] text-sm">{message}</p>}
      </div>
    </div>
  );
}
