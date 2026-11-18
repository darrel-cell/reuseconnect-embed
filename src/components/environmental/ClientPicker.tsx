import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { Client } from "@/mocks/mock-entities";
import { cn } from "@/lib/utils";

export type ClientOption = { id: string; label: string; detail?: string };

/** Clients as a sorted, searchable list: organisation name first, contact name as detail. */
export function useClientOptions(clients: Client[] | undefined): ClientOption[] {
  return useMemo(
    () =>
      (clients ?? [])
        .map((c) => ({
          id: c.id,
          label: c.organisationName?.trim() || c.name,
          detail: c.organisationName?.trim() && c.organisationName.trim() !== c.name ? c.name : undefined,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [clients]
  );
}

export function ClientPicker({
  id,
  options,
  value,
  onChange,
  loading,
  className = "w-72",
  allLabel,
}: {
  id: string;
  options: ClientOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  loading: boolean;
  className?: string;
  /** When set, offers this as a first choice that clears the selection (e.g. "All clients"). */
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between font-normal", className)}
        >
          <span className={cn("truncate", !selected && !allLabel && "text-muted-foreground")}>
            {loading ? "Loading clients…" : selected ? (
              <>
                {selected.label}
                {selected.detail && <span className="text-muted-foreground"> · {selected.detail}</span>}
              </>
            ) : (
              allLabel ?? "Choose a client"
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search clients…" />
          <CommandList>
            <CommandEmpty>No client found.</CommandEmpty>
            <CommandGroup>
              {allLabel && (
                <CommandItem
                  value={allLabel}
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === null ? "opacity-100" : "opacity-0")} />
                  {allLabel}
                </CommandItem>
              )}
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`${o.label} ${o.detail ?? ""} ${o.id}`}
                  onSelect={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", o.id === value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">
                    {o.label}
                    {o.detail && <span className="text-muted-foreground"> · {o.detail}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
