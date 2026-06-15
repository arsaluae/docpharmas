// ============================================================================
// Lightweight rich-text editor for Warranty Invoice notes.
// Pure contenteditable + document.execCommand for B, I, U, lists, alignment,
// plus a variable inserter. No external editor dependency — sanitised on blur
// before reporting back to the parent via onChange.
// ============================================================================

import { useEffect, useRef } from "react";
import {
  Bold, Italic, Underline as UIcon,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  CornerDownLeft, Variable,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { WARRANTY_TOKENS } from "@/lib/warranty-variables";
import { cn } from "@/lib/utils";

interface NotesEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
}

export function NotesEditor({ value, onChange, placeholder, minHeight = 180, className }: NotesEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Set initial / external value without losing caret on each keystroke
  useEffect(() => {
    if (!ref.current) return;
    if (ref.current.innerHTML !== value) ref.current.innerHTML = value || "";
  }, [value]);

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    try { document.execCommand(cmd, false, arg); } catch { /* noop */ }
    flush();
  };

  const flush = () => {
    if (!ref.current) return;
    onChange(sanitizeHtml(ref.current.innerHTML));
  };

  const insertToken = (token: string) => {
    ref.current?.focus();
    try {
      document.execCommand("insertText", false, token);
    } catch {
      // Fallback: append at the end
      if (ref.current) ref.current.innerText = (ref.current.innerText || "") + token;
    }
    flush();
  };

  return (
    <div className={cn("rounded-md border border-border bg-background", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-1.5 py-1">
        <TButton label="Bold (Ctrl+B)" onClick={() => exec("bold")}><Bold className="h-3.5 w-3.5" /></TButton>
        <TButton label="Italic (Ctrl+I)" onClick={() => exec("italic")}><Italic className="h-3.5 w-3.5" /></TButton>
        <TButton label="Underline (Ctrl+U)" onClick={() => exec("underline")}><UIcon className="h-3.5 w-3.5" /></TButton>
        <Divider />
        <TButton label="Bulleted list" onClick={() => exec("insertUnorderedList")}><List className="h-3.5 w-3.5" /></TButton>
        <TButton label="Numbered list" onClick={() => exec("insertOrderedList")}><ListOrdered className="h-3.5 w-3.5" /></TButton>
        <Divider />
        <TButton label="Align left" onClick={() => exec("justifyLeft")}><AlignLeft className="h-3.5 w-3.5" /></TButton>
        <TButton label="Align center" onClick={() => exec("justifyCenter")}><AlignCenter className="h-3.5 w-3.5" /></TButton>
        <TButton label="Align right" onClick={() => exec("justifyRight")}><AlignRight className="h-3.5 w-3.5" /></TButton>
        <Divider />
        <TButton label="Line break" onClick={() => exec("insertLineBreak")}><CornerDownLeft className="h-3.5 w-3.5" /></TButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
              <Variable className="h-3.5 w-3.5" /> Insert variable
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
            {WARRANTY_TOKENS.map((t) => (
              <DropdownMenuItem key={t.token} onClick={() => insertToken(t.token)}>
                <span className="font-mono text-[11px] mr-2">{t.token}</span>
                <span className="text-muted-foreground text-[11px]">{t.description}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={flush}
        onBlur={flush}
        className="prose prose-sm max-w-none p-3 text-sm focus:outline-none [&_p]:my-1 [&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:pl-6"
        style={{ minHeight }}
        data-placeholder={placeholder || "Type warranty notes…"}
      />
      <style>{`[contenteditable][data-placeholder]:empty::before{content:attr(data-placeholder);color:hsl(var(--muted-foreground));pointer-events:none;}`}</style>
    </div>
  );
}

function TButton({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <Button
      type="button" variant="ghost" size="icon"
      className="h-7 w-7"
      onMouseDown={(e) => e.preventDefault()} // keep caret in editor
      onClick={onClick}
      title={label}
    >{children}</Button>
  );
}

const Divider = () => <span className="mx-0.5 h-4 w-px bg-border" />;
