import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface PdfView {
  key: string;
  label: string;
  /** Tailwind colour utility set, e.g. "bg-blue-600 text-white border-blue-600" */
  color: string;
  html: string;
  disabled?: boolean;
}

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  html?: string;
  title?: string;
  /** Optional template switcher (3 pills above the preview). */
  views?: PdfView[];
  defaultView?: string;
}

export function PdfPreviewDialog({ open, onOpenChange, html, title, views, defaultView }: PdfPreviewDialogProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const enabledViews = (views || []).filter((v) => !v.disabled);
  const initial = defaultView && enabledViews.find((v) => v.key === defaultView)
    ? defaultView
    : enabledViews[0]?.key;
  const [active, setActive] = useState<string | undefined>(initial);

  useEffect(() => {
    if (open) setActive(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultView, views?.length]);

  const activeHtml = useMemo(() => {
    if (views && views.length) return views.find((v) => v.key === active)?.html || "";
    return html || "";
  }, [views, active, html]);

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(activeHtml);
      win.document.close();
      win.onload = () => { win.print(); };
      setTimeout(() => { try { win.print(); } catch(e) {} }, 600);
    }
  };

  const embeddedHtml = activeHtml.replace(
    /<div class="toolbar">[\s\S]*?<\/div>\s*(?=\s*<div class="page-frame")/,
    ""
  ).replace(
    /<\/head>/,
    `<style>
      body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
      .page-frame {
        margin: 0 auto !important;
        padding: 28px 32px !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        box-shadow: none !important;
        border: none !important;
      }
      .page-frame::before { display: none !important; }
      .corner { display: none !important; }
    </style></head>`
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none w-[98vw] h-[95vh] p-0 gap-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
        <DialogTitle className="sr-only">{title || "Document Preview"}</DialogTitle>
        <DialogDescription className="sr-only">Preview of {title || "document"}</DialogDescription>
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50 gap-3 flex-wrap">
          <span className="text-sm font-semibold truncate">{title || "Document Preview"}</span>
          {views && views.length > 1 && (
            <div className="flex items-center gap-1.5 p-1 rounded-full bg-background border border-border">
              {views.map((v) => {
                const isActive = v.key === active;
                return (
                  <button
                    key={v.key}
                    type="button"
                    disabled={v.disabled}
                    onClick={() => !v.disabled && setActive(v.key)}
                    className={cn(
                      "px-3 h-7 text-[11px] font-semibold uppercase tracking-wider rounded-full transition-all border",
                      v.disabled && "opacity-40 cursor-not-allowed border-transparent text-muted-foreground",
                      !v.disabled && !isActive && "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted",
                      !v.disabled && isActive && v.color
                    )}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handlePrint}>
              <Download className="h-3.5 w-3.5" /> Download / Print
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* iframe */}
        <iframe
          ref={iframeRef}
          srcDoc={embeddedHtml}
          className="w-full flex-1 border-0"
          title="Document Preview"
          sandbox="allow-same-origin allow-scripts allow-popups allow-modals"
        />
      </DialogContent>
    </Dialog>
  );
}
