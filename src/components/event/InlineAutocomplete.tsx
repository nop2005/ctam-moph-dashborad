import { useEffect, useRef, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineAutocompleteProps<T> {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  onSelect: (item: T) => void;
  fetcher: (query: string) => Promise<T[]>;
  placeholder?: string;
  minChars?: number;
  renderItem: (item: T) => ReactNode;
  itemKey: (item: T) => string;
  className?: string;
  emptyText?: string;
}

export function InlineAutocomplete<T>({
  id,
  value,
  onChange,
  onSelect,
  fetcher,
  placeholder,
  minChars = 1,
  renderItem,
  itemKey,
  className,
  emptyText = "ไม่พบข้อมูล — พิมพ์เองในช่องได้เลย",
}: InlineAutocompleteProps<T>) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<T[]>([]);
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focused) return;
    if (value.trim().length < minChars) {
      setItems([]);
      setOpen(false);
      return;
    }
    let active = true;
    setLoading(true);
    setOpen(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetcher(value.trim());
        if (!active) return;
        setItems(res);
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [value, focused, minChars, fetcher]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          setFocused(true);
          if (value.trim().length >= minChars) setOpen(true);
        }}
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-72 overflow-auto">
          {loading && (
            <div className="py-4 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              กำลังค้นหา...
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="py-3 px-3 text-xs text-muted-foreground">{emptyText}</div>
          )}
          {!loading &&
            items.map((it) => (
              <button
                key={itemKey(it)}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(it);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent border-b last:border-b-0"
              >
                {renderItem(it)}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
