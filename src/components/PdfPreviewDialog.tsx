import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
// html2pdf.js ships without bundled types
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

/**
 * Inject CSS that hides the in-document toolbar/page-frame chrome and forces
 * a flat A4 white background. Works for both warranty (`.page`) and the
 * legacy A4 (`.page-frame`) templates without per-document regex.
 */
const PRINT_CHROME_CSS = `
  html, body { margin:0 !important; padding:0 !important; background:#fff !important; }
  .toolbar { display:none !important; }
  .page-frame, .page, .warranty-document {
    box-shadow:none !important;
    border:none !important;
    margin:0 auto !important;
    background:#fff !important;
    max-width:100% !important;
    page-break-after: avoid !important;
    break-after: avoid !important;
  }
  .page-frame::before, .corner { display:none !important; }
  @page { size: A4 portrait; margin: 8mm; }
  /* Keep rows / sections together across page breaks during snapshot */
  table { page-break-inside: auto; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr, .no-break, [data-pdf-section], .totals-card, .signatures {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  /* On-screen instruction banner — hidden during print */
  .print-tip-banner {
    margin: 8px auto; max-width: 794px; padding: 8px 14px;
    background: #fef3c7; border: 1px solid #fde68a; border-left: 3px solid #f59e0b;
    color: #78350f; font: 12px/1.4 -apple-system, 'Segoe UI', sans-serif; border-radius: 4px;
  }
  @media print { .print-tip-banner { display: none !important; } }
`;

function injectChromeCss(html: string): string {
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `<style>${PRINT_CHROME_CSS}</style></head>`);
  }
  return `<style>${PRINT_CHROME_CSS}</style>${html}`;
}

export function PdfPreviewDialog({ open, onOpenChange, html, title, views, defaultView }: PdfPreviewDialogProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [downloading, setDownloading] = useState(false);

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

  const embeddedHtml = useMemo(() => injectChromeCss(activeHtml), [activeHtml]);

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (win) {
      // Inject a non-print on-screen tip telling the user to disable browser
      // headers/footers (which print URL / date / page numbers).
      const tipHtml = `<div class="print-tip-banner">For a clean printout, in the browser's print dialog open <b>More settings</b> and uncheck <b>Headers and footers</b>. Choose <b>A4</b> paper, <b>Default</b> margins.</div>`;
      const withTip = /<body[^>]*>/i.test(embeddedHtml)
        ? embeddedHtml.replace(/<body([^>]*)>/i, `<body$1>${tipHtml}`)
        : tipHtml + embeddedHtml;
      win.document.write(withTip);
      win.document.close();
      win.onload = () => { win.print(); };
      setTimeout(() => { try { win.print(); } catch(e) {} }, 600);
    }
  };

  /**
   * Render the active HTML into a hidden same-origin iframe, wait for the
   * document + every <img> to decode, then snapshot the iframe body with
   * html2pdf. This avoids:
   *   • blank pages when images (logo / signature / stamp) haven't loaded
   *   • B&W rendering when external stylesheets aren't carried over
   *   • toolbar leaking onto the first page
   */
  const handleDownloadPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    const iframe = document.createElement("iframe");
    // A4 portrait at 96dpi ≈ 794 x 1123 px.
    const A4_W = 794;
    const A4_H = 1123;
    iframe.style.position = "fixed";
    iframe.style.left = "-10000px";
    iframe.style.top = "0";
    iframe.style.width = `${A4_W}px`;
    iframe.style.height = `${A4_H}px`;
    iframe.style.border = "0";
    iframe.style.background = "#ffffff";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    try {
      await new Promise<void>((resolve) => {
        iframe.onload = () => resolve();
        iframe.srcdoc = embeddedHtml;
      });

      const doc = iframe.contentDocument;
      if (!doc) throw new Error("PDF iframe failed to initialise");

      const fontsReady = (doc as any).fonts?.ready?.catch(() => undefined) || Promise.resolve();
      const imgs = Array.from(doc.images);
      await Promise.all([
        fontsReady,
        ...imgs.map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise<void>((res) => {
            img.addEventListener("load", () => res(), { once: true });
            img.addEventListener("error", () => res(), { once: true });
          });
        }),
        new Promise<void>((res) => setTimeout(res, 120)),
      ]);

      const filename = `${(title || "Document").replace(/[^a-z0-9\-_.]+/gi, "-")}.pdf`;
      const isHalfPage = doc.documentElement.getAttribute("data-page-mode") === "half";

      const target = doc.body;
      target.style.background = "#ffffff";

      if (isHalfPage) {
        // Render exactly one A4 page; document occupies top 138mm, lower half blank.
        // Force body to a full A4 sheet so html2canvas captures the blank lower half too.
        target.style.width = `${A4_W}px`;
        target.style.minHeight = `${A4_H}px`;
        target.style.height = `${A4_H}px`;
        target.style.padding = "0";
        target.style.margin = "0";

        await html2pdf()
          .set({
            margin: 0,
            filename,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: {
              scale: 2,
              useCORS: true,
              allowTaint: false,
              backgroundColor: "#ffffff",
              windowWidth: A4_W,
              width: A4_W,
              height: A4_H,
              logging: false,
              scrollX: 0,
              scrollY: 0,
            },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
            pagebreak: { mode: ["css"] },
          } as any)
          .from(target)
          .save();
      } else {
        // Full A4 multi-page (original path)
        const measuredWidth = Math.min(
          A4_W,
          Math.max(target.scrollWidth, target.getBoundingClientRect().width || 0, A4_W)
        );
        await html2pdf()
          .set({
            margin: [8, 8, 8, 8],
            filename,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: {
              scale: 2,
              useCORS: true,
              allowTaint: false,
              backgroundColor: "#ffffff",
              windowWidth: measuredWidth,
              width: measuredWidth,
              logging: false,
              scrollX: 0,
              scrollY: 0,
            },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
            pagebreak: { mode: ["css", "legacy"], avoid: ["tr", ".no-break", "[data-pdf-section]"] },
          } as any)
          .from(target)
          .save();
      }
    } catch (e) {
      console.error("PDF download failed", e);
    } finally {
      iframe.remove();
      setDownloading(false);
    }
  };

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
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handlePrint} disabled={downloading}>
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleDownloadPdf} disabled={downloading}>
              <Download className="h-3.5 w-3.5" /> {downloading ? "Saving…" : "Save as PDF"}
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
