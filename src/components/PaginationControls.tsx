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
}

export const PaginationControls = React.forwardRef<HTMLDivElement, Props>(function PaginationControls({ page, totalPages, totalCount, hasNext, hasPrev, onNext, onPrev, pageSize }, ref) {
  if (totalCount <= pageSize) return null;
  
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, totalCount);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <p className="text-xs text-muted-foreground">
        Showing {from}–{to} of {totalCount.toLocaleString()}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={!hasPrev} onClick={onPrev} className="h-7 text-xs">
          <ChevronLeft className="h-3 w-3 mr-1" /> Prev
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {page + 1} of {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={!hasNext} onClick={onNext} className="h-7 text-xs">
          Next <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}
