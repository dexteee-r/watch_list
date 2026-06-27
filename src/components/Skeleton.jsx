// Content-shaped shimmer placeholder (better perceived performance than a spinner).
export default function Skeleton({ className = '' }) {
  return (
    <div
      role="status"
      aria-label="Chargement"
      className={`animate-pulse rounded-md bg-zinc-800/80 ${className}`}
    />
  )
}

// Poster-card skeleton matching the ShowCard layout.
export function ShowCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
      <Skeleton className="aspect-2/3 w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-16 rounded-full" />
        <Skeleton className="h-2 w-full" />
      </div>
    </div>
  )
}
