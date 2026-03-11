import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2 } from "lucide-react";
import { useRef } from "react";

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  html: string;
  title?: string;
}

export function PdfPreviewDialog({ open, onOpenChange, html, title }: PdfPreviewDialogProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handlePrint = () => {
    // Open in new tab — works reliably on mobile and desktop
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  const handleDownload = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "Document"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Strip toolbar from embedded view and inject fit-to-width CSS
  const embeddedHtml = html.replace(
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
      <DialogContent className="max-w-none w-[98vw] h-[95vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogTitle className="sr-only">{title || "Document Preview"}</DialogTitle>
        <DialogDescription className="sr-only">Preview of {title || "document"}</DialogDescription>
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
          <span className="text-sm font-semibold truncate">{title || "Document Preview"}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleDownload}>
              <Share2 className="h-3.5 w-3.5" /> Save
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handlePrint}>
              <Download className="h-3.5 w-3.5" /> Download / Print
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
