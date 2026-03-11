import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

const PAGE_NEW_ACTION: Record<string, string> = {
  "/proforma": "action=new",
  "/purchase-proforma": "action=new",
  "/customers": "action=new",
  "/products": "action=new",
  "/payments": "action=new",
  "/expenses": "action=new",
};

const shortcuts = [
  { keys: ["Ctrl", "K"], desc: "Open search / command palette" },
  { keys: ["Ctrl", "N"], desc: "New record (context-aware)" },
  { keys: ["Esc"], desc: "Close dialog / palette" },
  { keys: ["?"], desc: "Show this shortcuts help" },
];

interface Props {
  onOpenPalette: () => void;
}

export function useGlobalShortcuts({ onOpenPalette }: Props) {
  const location = useLocation();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      // Ctrl+K — command palette
      if (isMeta && e.key === "k") {
        e.preventDefault();
        onOpenPalette();
        return;
      }

      // Ctrl+N — new record
      if (isMeta && e.key === "n") {
        const qs = PAGE_NEW_ACTION[location.pathname];
        if (qs) {
          e.preventDefault();
          // Dispatch a custom event that pages can listen to
          window.dispatchEvent(new CustomEvent("docpharmas:new-record"));
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpenPalette, location.pathname]);
}

export function ShortcutsHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground transition-all w-full"
          title="Keyboard Shortcuts"
        >
          <Keyboard className="h-4 w-4" />
          <span>Shortcuts</span>
          <kbd className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">?</kbd>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {shortcuts.map((s) => (
            <div key={s.desc} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-foreground">{s.desc}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd key={k} className="min-w-[28px] text-center text-xs font-mono px-2 py-1 rounded-md bg-muted text-muted-foreground border border-border shadow-sm">
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
