export default function MessageSkeleton() {
  return (
    <div className="px-4 py-2 space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-layer-4 shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 w-24 bg-layer-4 rounded" />
            <div className="space-y-1">
              <div className="h-3 w-full max-w-md bg-layer-4 rounded" />
              <div className="h-3 w-3/4 max-w-sm bg-layer-4 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
