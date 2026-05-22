import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AreaRow { id: string; name: string; city: string | null }

interface AreaSelectProps {
  value: string;
  onChange: (value: string) => void;
  city?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Combobox for areas, filtered by selected city. Allows inline create.
 * Stores area name (text) — table `areas` is the master list per tenant.
 */
export function AreaSelect({ value, onChange, city, placeholder = "Select area", className }: AreaSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [areas, setAreas] = useState<AreaRow[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("areas").select("id, name, city").order("name");
    setAreas((data || []) as AreaRow[]);
  };

  // Show areas matching selected city first; if none, show all.
  const cityMatched = city ? areas.filter(a => (a.city || "").toLowerCase() === city.toLowerCase()) : areas;
  const filtered = (cityMatched.length ? cityMatched : areas).filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const exists = areas.some(a => a.name.toLowerCase() === search.trim().toLowerCase() && (city ? (a.city || "").toLowerCase() === city.toLowerCase() : true));
  const canCreate = search.trim().length > 0 && !exists;

  const createArea = async () => {
    const name = search.trim();
    if (!name) return;
    const { error } = await supabase.from("areas").insert({ name, city: city || null } as any);
    if (error) { toast.error("Failed to add area"); return; }
    toast.success(`Area "${name}" added`);
    setSearch("");
    onChange(name);
    setOpen(false);
    await load();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal h-9 text-sm", !value && "text-muted-foreground", className)}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={city ? `Search areas in ${city}…` : "Search areas…"}
            value={search}
            onValueChange={setSearch}
            className="h-8 text-sm"
          />
          <CommandList>
            {filtered.length === 0 && !canCreate && (
              <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">No areas yet.</CommandEmpty>
            )}
            {filtered.length > 0 && (
              <CommandGroup>
                {filtered.map(a => (
                  <CommandItem
                    key={a.id}
                    value={a.name}
                    onSelect={() => { onChange(a.name); setOpen(false); }}
                    className="text-sm"
                  >
                    <Check className={cn("mr-2 h-3.5 w-3.5", value === a.name ? "opacity-100" : "opacity-0")} />
                    {a.name}
                    {a.city && <span className="ml-auto text-[10px] text-muted-foreground">{a.city}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {canCreate && (
              <CommandGroup heading="New">
                <CommandItem onSelect={createArea} className="text-sm">
                  <Plus className="mr-2 h-3.5 w-3.5" /> Add "{search.trim()}"{city ? ` in ${city}` : ""}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
