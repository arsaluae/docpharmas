import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Download, X } from "lucide-react";
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
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.print();
    }
  };

  const handleOpenTab = () => {
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  // Strip toolbar from embedded view since we have our own controls
  const embeddedHtml = html.replace(
    /<div class="toolbar">[\s\S]*?<\/div>\s*(?=\s*<div class="page-frame")/,
    ""
  ).replace(
    /margin:80px auto 40px/,
    "margin:20px auto"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[90vw] h-[85vh] p-0 gap-0 overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
          <span className="text-sm font-semibold truncate">{title || "Document Preview"}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handlePrint}>
              <Download className="h-3.5 w-3.5" /> Download / Print
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={handleOpenTab}>
              Open in Tab
            </Button>
          </div>
        </div>
        {/* iframe */}
        <iframe
          ref={iframeRef}
          srcDoc={embeddedHtml}
          className="w-full flex-1 border-0"
          title="Document Preview"
          sandbox="allow-same-origin allow-scripts allow-popups"
        />
      </DialogContent>
    </Dialog>
  );
}
