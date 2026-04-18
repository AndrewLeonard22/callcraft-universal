import { useState, useRef, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface TagOption {
  slug: string;
  label: string;
}

interface TagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  options?: TagOption[];
  placeholder?: string;
  className?: string;
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

const labelFromSlug = (slug: string, options: TagOption[]): string => {
  const match = options.find((o) => o.slug === slug);
  if (match) return match.label;
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

export function TagInput({
  value,
  onChange,
  options = [],
  placeholder = "Add tag...",
  className,
}: TagInputProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (raw: string) => {
    const slug = slugify(raw);
    if (!slug || value.includes(slug)) return;
    onChange([...value, slug]);
    setInputValue("");
  };

  const removeTag = (slug: string) => {
    onChange(value.filter((v) => v !== slug));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && inputValue.trim()) {
      e.preventDefault();
      addTag(inputValue);
      setOpen(false);
    }
    if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  const filteredOptions = options.filter(
    (o) =>
      !value.includes(o.slug) &&
      (inputValue === "" ||
        o.label.toLowerCase().includes(inputValue.toLowerCase()) ||
        o.slug.includes(inputValue.toLowerCase()))
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className={`min-h-[2.5rem] flex flex-wrap gap-1.5 p-2 border border-input rounded-md bg-background
            cursor-text focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${className ?? ""}`}
          onClick={() => {
            inputRef.current?.focus();
            setOpen(true);
          }}
        >
          {value.map((slug) => (
            <Badge
              key={slug}
              variant="secondary"
              className="gap-1 pr-1 text-xs font-medium"
            >
              {labelFromSlug(slug, options)}
              <button
                type="button"
                className="rounded-sm opacity-70 hover:opacity-100 focus:outline-none"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(slug);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (!open) setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            placeholder={value.length === 0 ? placeholder : ""}
            className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-64"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandInput
            placeholder="Search or type custom..."
            value={inputValue}
            onValueChange={setInputValue}
            className="h-8 text-sm"
          />
          <CommandList>
            <CommandEmpty>
              {inputValue.trim() ? (
                <button
                  className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addTag(inputValue);
                    setOpen(false);
                  }}
                >
                  Add &ldquo;{inputValue.trim()}&rdquo;
                </button>
              ) : (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  No options. Type to add custom.
                </p>
              )}
            </CommandEmpty>
            {filteredOptions.length > 0 && (
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.slug}
                    value={option.slug}
                    onSelect={() => {
                      addTag(option.slug);
                      setOpen(false);
                      inputRef.current?.focus();
                    }}
                  >
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {inputValue.trim() && filteredOptions.length > 0 && (
              <CommandGroup heading="Custom">
                <CommandItem
                  value={`__custom__${inputValue}`}
                  onSelect={() => {
                    addTag(inputValue);
                    setOpen(false);
                    inputRef.current?.focus();
                  }}
                >
                  Add &ldquo;{inputValue.trim()}&rdquo;
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export const HARD_NO_OPTIONS: TagOption[] = [
  { slug: "pools", label: "NO POOLS" },
  { slug: "decks", label: "NO DECKS" },
  { slug: "electrical", label: "NO ELECTRICAL" },
  { slug: "lighting", label: "NO LIGHTING INSTALLS" },
  { slug: "hot_tubs", label: "NO HOT TUBS" },
  { slug: "tree_removal", label: "NO TREE REMOVAL" },
  { slug: "concrete", label: "NO CONCRETE" },
  { slug: "fencing", label: "NO FENCING" },
  { slug: "roofing", label: "NO ROOFING" },
  { slug: "water_features", label: "NO WATER FEATURES" },
  { slug: "bbq_islands", label: "NO BBQ ISLANDS" },
];

export const SERVICES_ADVERTISED_OPTIONS: TagOption[] = [
  { slug: "pavers", label: "Pavers / Hardscaping" },
  { slug: "turf", label: "Artificial Turf" },
  { slug: "pergola", label: "Pergolas" },
  { slug: "outdoor_kitchen", label: "Outdoor Kitchens" },
  { slug: "fire_pit", label: "Fire Pits" },
  { slug: "pool_deck", label: "Pool Decks" },
  { slug: "retaining_wall", label: "Retaining Walls" },
  { slug: "lighting", label: "Landscape Lighting" },
  { slug: "drainage", label: "Drainage Solutions" },
  { slug: "seating_wall", label: "Seating Walls" },
  { slug: "bbq_islands", label: "BBQ Islands" },
  { slug: "water_features", label: "Water Features" },
  { slug: "full_backyard_remodel", label: "Full Backyard Remodel" },
];
