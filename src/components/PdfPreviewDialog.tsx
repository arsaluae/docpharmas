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
  /* Keep rows / sections together across page breaks during snapshot */
  table { page-break-inside: auto; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr, .no-break, [data-pdf-section], .totals-card, .signatures {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
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

  /**
   * Build a PDF (jsPDF) from the active document HTML using a hidden iframe.
   * Returns the jsPDF instance; caller decides save vs preview-in-new-tab.
   * For half-A4 docs we constrain output to a single A4 page (top half = content,
   * bottom half = blank), so neither Save nor Print spill onto a 2nd page.
   */
  const buildPdf = async () => {
    const iframe = document.createElement("iframe");
    const A4_W = 794;   // A4 portrait at 96dpi
    const A4_H = 1123;
    
    iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${A4_W}px;height:${A4_H}px;border:0;background:#fff;`;
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    try {
      await new Promise<void>((resolve) => {
        iframe.onload = () => resolve();
        iframe.srcdoc = embeddedHtml;
      });
      const doc = iframe.contentDocument;
      if (!doc) throw new Error("PDF iframe failed to initialise");

      // Wait for fonts + images so logos render
      const fontsReady = (doc as any).fonts?.ready?.catch(() => undefined) || Promise.resolve();
      const imgs = Array.from(doc.images);
      await Promise.all([
        fontsReady,
        ...imgs.map((img) => img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>((res) => {
              img.addEventListener("load", () => res(), { once: true });
              img.addEventListener("error", () => res(), { once: true });
            })),
        new Promise<void>((res) => setTimeout(res, 150)),
      ]);

      const filename = `${(title || "Document").replace(/[^a-z0-9\-_.]+/gi, "-")}.pdf`;
      const isHalfPage = doc.documentElement.getAttribute("data-page-mode") === "half";

      // Find the actual document sheet
      const sheet = (doc.querySelector(".page-frame, .warranty-document, .page") as HTMLElement) || doc.body;
      sheet.style.background = "#ffffff";

      if (isHalfPage) {
        // Half-A4: content sheet is naturally short. Render at its real height so
        // the PDF is exactly ONE page with blank lower half.
        const config = {
          margin: [6, 8, 6, 8],
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 3, useCORS: true, allowTaint: false, backgroundColor: "#ffffff",
            windowWidth: A4_W, width: A4_W,
            logging: false, scrollX: 0, scrollY: 0,
            letterRendering: true, imageTimeout: 0,
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
          pagebreak: { mode: ["avoid-all"], avoid: ["tr", ".no-break", "[data-pdf-section]", ".totals-card", ".signatures"] },
        } as any;
        const worker: any = html2pdf().set(config).from(sheet).toPdf();
        const pdf: any = await worker.get("pdf");
        // Hard-cap to one page in case content slightly overflows.
        const total = pdf.internal.getNumberOfPages();
        for (let i = total; i > 1; i--) pdf.deletePage(i);
        return { pdf, filename };
      } else {
        const measuredWidth = Math.min(A4_W, Math.max(sheet.scrollWidth, A4_W));
        const config = {
          margin: [8, 8, 8, 8],
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2, useCORS: true, allowTaint: false, backgroundColor: "#ffffff",
            windowWidth: measuredWidth, width: measuredWidth,
            logging: false, scrollX: 0, scrollY: 0,
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
          pagebreak: { mode: ["css", "legacy"], avoid: ["tr", ".no-break", "[data-pdf-section]", ".totals-card", ".signatures"] },
        } as any;
        const worker: any = html2pdf().set(config).from(sheet).toPdf();
        const pdf = await worker.get("pdf");
        return { pdf, filename };
      }
    } finally {
      iframe.remove();
    }
  };

  const handleDownloadPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const { pdf, filename } = await buildPdf();
      pdf.save(filename);
    } catch (e) {
      console.error("PDF download failed", e);
    } finally {
      setDownloading(false);
    }
  };

  /**
   * Print = generate the same PDF we'd download, open it in a new tab as a blob,
   * then trigger the browser's PDF viewer print. No app chrome, no browser
   * header/footer drift, identical to Save as PDF output.
   */
  const handlePrint = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const { pdf } = await buildPdf();
      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (win) {
        // Give the embedded PDF viewer a moment, then ask it to print.
        setTimeout(() => { try { win.focus(); win.print(); } catch (e) { /* viewer handles it */ } }, 800);
      }
      // Revoke later so the tab can keep using the URL
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      console.error("Print failed", e);
    } finally {
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
