import { cn } from "@/lib/utils";

interface SkeletonRowProps {
  columns?: number;
  rows?: number;
  className?: string;
}

/**
 * Dark shimmer row for table loading states.
 */
export function SkeletonRow({ columns = 5, rows = 6, className }: SkeletonRowProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className={cn("border-b border-border/40", className)}>
          {Array.from({ length: columns }).map((_, c) => (
            <td key={c} className="px-3 py-3 first:pl-4 last:pr-4">
              <div
                className="skeleton-shimmer h-3 rounded"
                style={{ width: `${40 + ((r + c) % 4) * 15}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
