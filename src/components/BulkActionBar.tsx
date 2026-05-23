import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, X, Loader2 } from "lucide-react";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Props {
  selectedIds: string[];
  onClear: () => void;
  /** Async function that deletes a single id. Throw to signal failure. */
  onDeleteOne: (id: string) => Promise<void>;
  entityLabel: string; // e.g. "credit note"
  onDone?: () => void;
}

/** Sticky bottom bar that appears when 1+ rows are checked. */
export function BulkActionBar({ selectedIds, onClear, onDeleteOne, entityLabel, onDone }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (selectedIds.length === 0) return null;

  const runDelete = async () => {
    setBusy(true);
    let ok = 0, failed: { id: string; err: string }[] = [];
    for (const id of selectedIds) {
      try { await onDeleteOne(id); ok++; }
      catch (e: any) { failed.push({ id, err: e?.message || String(e) }); }
    }
    setBusy(false);
    setConfirmOpen(false);
    if (failed.length === 0) toast.success(`Deleted ${ok} ${entityLabel}${ok !== 1 ? "s" : ""}`);
    else toast.error(`Deleted ${ok}, ${failed.length} failed — ${failed[0].err}`);
    onClear();
    onDone?.();
  };

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-full bg-background border border-border shadow-lg">
        <span className="text-sm font-medium tabular-nums">{selectedIds.length} selected</span>
        <div className="h-4 w-px bg-border" />
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive" onClick={() => setConfirmOpen(true)} disabled={busy}>
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClear} disabled={busy}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} {entityLabel}{selectedIds.length !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the selected records and reverse any associated balance / stock changes. Cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runDelete} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting...</> : "Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Reusable checkbox helpers for a list page. */
export function useBulkSelection() {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const toggleAll = (ids: string[]) => setSelected(s => s.length === ids.length ? [] : ids);
  const isSelected = (id: string) => selected.includes(id);
  const clear = () => setSelected([]);
  return { selected, toggle, toggleAll, isSelected, clear };
}

export function RowCheckbox({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <div onClick={e => e.stopPropagation()}>
      <Checkbox checked={checked} onCheckedChange={(v) => onCheckedChange(!!v)} />
    </div>
  );
}
