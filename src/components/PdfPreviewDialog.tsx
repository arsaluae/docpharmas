import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
// @ts-expect-error - html2pdf.js ships without types
import html2pdf from "html2pdf.js";

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

  const handleDownloadPdf = async () => {
    // Build a detached container so html2pdf can rasterise the document at A4.
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-10000px";
    container.style.top = "0";
    container.style.width = "210mm";
    container.style.background = "#fff";
    // Strip the screen toolbar/page-frame shadow; html2pdf paginates the body.
    const cleanedHtml = activeHtml
      .replace(/<div class="toolbar">[\s\S]*?<\/div>\s*(?=\s*<div class="page-frame")/, "")
      .replace(/<\/head>/, `<style>
        body { margin:0 !important; padding:0 !important; background:#fff !important; }
        .page-frame, .page { box-shadow:none !important; border:none !important; margin:0 !important; }
        .page-frame::before, .corner { display:none !important; }
      </style></head>`);
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleanedHtml, "text/html");
    container.innerHTML = doc.body.innerHTML;
    // Carry over inline <style> blocks from <head> so layout/colours render.
    doc.head.querySelectorAll("style").forEach((s) => {
      const clone = document.createElement("style");
      clone.textContent = s.textContent || "";
      container.appendChild(clone);
    });
    document.body.appendChild(container);
    const filename = `${(title || "Document").replace(/[^a-z0-9\-_.]+/gi, "-")}.pdf`;
    try {
      await html2pdf()
        .set({
          margin: 0,
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"] },
        })
        .from(container)
        .save();
    } finally {
      container.remove();
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
