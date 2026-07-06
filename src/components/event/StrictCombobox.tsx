import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StrictComboboxProps<T> {
  id?: string;
  value: string;
  displayValue?: string;
  onSelect: (item: T) => void;
  fetcher: (query: string) => Promise<T[]>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  itemKey: (item: T) => string;
  itemLabel: (item: T) => string;
  renderItem?: (item: T) => ReactNode;
  disabled?: boolean;
  className?: string;
}

export function StrictCombobox<T>({
  id,
  value,
  displayValue,
  onSelect,
  fetcher,
  placeholder = "เลือก...",
  searchPlaceholder = "พิมพ์เพื่อค้นหา...",
  emptyText = "ไม่พบข้อมูล",
  itemKey,
  itemLabel,
  renderItem,
  disabled,
  className,
}: StrictComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    const myId = ++reqIdRef.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetcher(query.trim());
        if (reqIdRef.current === myId) setItems(res);
      } catch {
        if (reqIdRef.current === myId) setItems([]);
      } finally {
        if (reqIdRef.current === myId) setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query, open, fetcher]);

  const label = displayValue || value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !label && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{label || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[--radix-popover-trigger-width] min-w-[280px]"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-72">
            {loading && (
              <div className="py-4 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                กำลังค้นหา...
              </div>
            )}
            {!loading && items.length === 0 && (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
            {!loading && items.length > 0 && (
              <CommandGroup>
                {items.map((it) => {
                  const key = itemKey(it);
                  const lbl = itemLabel(it);
                  return (
                    <CommandItem
                      key={key}
                      value={key}
                      onSelect={() => {
                        onSelect(it);
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === lbl ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        {renderItem ? renderItem(it) : lbl}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
