import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
  pageSize: number;
  onJump?: (page: number) => void;
}

/**
 * Linear-style pagination — "Prev / 1 2 3 … 24 / Next".
 * Numbered jumps render only when onJump is provided.
 */
export const PaginationControls = React.forwardRef<HTMLDivElement, Props>(function PaginationControls(
  { page, totalPages, totalCount, hasNext, hasPrev, onNext, onPrev, pageSize, onJump },
  ref,
) {
  if (totalCount <= pageSize) return null;

  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, totalCount);

  // Build a compact list of page numbers around the current page.
  const renderPages = () => {
    if (!onJump || totalPages <= 1) return null;
    const current = page + 1; // 1-indexed display
    const pages: (number | "…")[] = [];
    const add = (n: number) => { if (!pages.includes(n)) pages.push(n); };

    add(1);
    if (current - 2 > 2) pages.push("…");
    for (let n = Math.max(2, current - 1); n <= Math.min(totalPages - 1, current + 1); n++) add(n);
    if (current + 2 < totalPages - 1) pages.push("…");
    if (totalPages > 1) add(totalPages);

    return (
      <div className="flex items-center gap-0.5 px-1">
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1.5 text-[12px] text-muted-foreground/60 font-mono">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onJump(p - 1)}
              className={`min-w-[26px] h-7 px-2 text-[12px] font-mono rounded transition-colors duration-150 ${
                p - 1 === page
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ),
        )}
      </div>
    );
  };

  return (
    <div
      ref={ref}
      className="flex items-center justify-between px-4 py-3 border-t border-border"
    >
      <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
        <span className="font-mono normal-case tracking-normal text-foreground/80">
          {from.toLocaleString()}–{to.toLocaleString()}
        </span>{" "}
        of <span className="font-mono normal-case tracking-normal text-foreground/80">{totalCount.toLocaleString()}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={!hasPrev}
          onClick={onPrev}
          className="h-7 px-2 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3 w-3 mr-0.5" strokeWidth={1.5} /> Previous
        </Button>
        {renderPages() ?? (
          <span className="px-2 text-[12px] text-muted-foreground font-mono">
            {page + 1} / {totalPages}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={!hasNext}
          onClick={onNext}
          className="h-7 px-2 text-[12px] text-muted-foreground hover:text-foreground"
        >
          Next <ChevronRight className="h-3 w-3 ml-0.5" strokeWidth={1.5} />
        </Button>
      </div>
    </div>
  );
});
