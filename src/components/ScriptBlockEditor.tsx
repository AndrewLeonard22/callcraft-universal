import { useCallback, useMemo, useRef, useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { parseScript } from "@/components/ScriptTeleprompter";

// Block-based script editing (Andrew: "you see how those sections are? we can
// drag and drop the blue where we want it... a really nice, seamless edit").
// The editor edits the SAME model the teleprompter renders: each block is a
// draggable, in-place-editable card in the viewer's own visual language, and
// the whole thing serializes back to the stored HTML on every change.

export interface ScriptBlockEditorProps {
  value: string;
  onChange: (html: string) => void;
}

type EB =
  | { id: number; kind: "module"; num: string }
  | { id: number; kind: "section" }
  | { id: number; kind: "caption" }
  | { id: number; kind: "say" }
  | { id: number; kind: "direction" }
  | { id: number; kind: "rules"; label: string }
  | { id: number; kind: "text" };

const ADDABLE: { kind: EB["kind"]; label: string; hint: string }[] = [
  { kind: "say", label: "Say line", hint: "spoken out loud" },
  { kind: "rules", label: "Coaching", hint: "rules for the setter" },
  { kind: "direction", label: "Direction", hint: "(wait for yes)" },
  { kind: "section", label: "Section", hint: "sub-heading" },
  { kind: "module", label: "Module", hint: "numbered stage" },
  { kind: "text", label: "Text", hint: "plain paragraph" },
];

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// tp-ph chips go back to their stored [Placeholder] form.
const chipsBack = (html: string) =>
  html.replace(/<span class="tp-ph"[^>]*>([\s\S]*?)<\/span>/gi, "[$1]");

export function ScriptBlockEditor({ value, onChange }: ScriptBlockEditorProps) {
  // Parse ONCE on mount — after that the editor owns the structure and the
  // DOM owns the text (uncontrolled contentEditable; feeding edits back into
  // React would reset the caret on every keystroke).
  const [initial] = useState(() => {
    const uid = { n: 0 };
    const blocks: EB[] = [];
    const html: Record<number, string> = {};
    for (const b of parseScript(value, false)) {
      const id = uid.n++;
      switch (b.kind) {
        case "module":
          blocks.push({ id, kind: "module", num: b.num ?? "" });
          html[id] = escapeHtml(b.title);
          break;
        case "section":
          blocks.push({ id, kind: "section" });
          html[id] = escapeHtml(b.title);
          break;
        case "caption":
          if (b.lane === "say") { blocks.push({ id, kind: "caption" }); html[id] = escapeHtml(b.text); }
          break; // rules captions re-emerge from the rules block's label
        case "say":
          blocks.push({ id, kind: "say" });
          html[id] = b.html;
          break;
        case "direction":
          blocks.push({ id, kind: "direction" });
          html[id] = escapeHtml(b.text);
          break;
        case "rules":
          blocks.push({ id, kind: "rules", label: b.label });
          html[id] = b.items.map((r) => escapeHtml(r.lead ? `${r.lead}: ${r.body}` : r.body)).join("\n");
          break;
        case "text":
          blocks.push({ id, kind: "text" });
          html[id] = b.html;
          break;
        case "timeline":
          break; // view-time widget, never stored
      }
    }
    return { blocks, html, uid };
  });

  const [blocks, setBlocks] = useState<EB[]>(initial.blocks);
  const htmlRef = useRef<Record<number, string>>(initial.html);
  const uidRef = useRef(initial.uid);
  const emitTimer = useRef<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [addAt, setAddAt] = useState<number | null>(null);

  const serialize = useCallback((list: EB[]) => {
    const out: string[] = [];
    for (const b of list) {
      const raw = htmlRef.current[b.id] ?? "";
      const text = raw.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
      switch (b.kind) {
        case "module":
          if (text) out.push(`<h2>Module ${b.num || "1"}: ${text}</h2>`);
          break;
        case "section":
          if (text) out.push(`<h3>${text}</h3>`);
          break;
        case "caption":
          if (text) out.push(`<p>${/[:：]$/.test(text) ? text : `${text}:`}</p>`);
          break;
        case "say": {
          const h = chipsBack(raw).trim();
          if (!h.replace(/<[^>]*>/g, "").trim()) break;
          out.push(`<p>${/<mark[\s>]/i.test(h) ? h : `<mark>${h}</mark>`}</p>`);
          break;
        }
        case "direction":
          if (text) out.push(`<p>(${text.replace(/^\(|\)$/g, "")})</p>`);
          break;
        case "rules": {
          const lines = raw
            .replace(/<div>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "")
            .split("\n").map((l) => l.replace(/&nbsp;/g, " ").trim()).filter(Boolean);
          if (!lines.length) break;
          out.push(`<p>${/[:：]$/.test(b.label) ? b.label : `${b.label}:`}</p>`);
          for (const l of lines) out.push(`<p>${escapeHtml(l)}</p>`);
          break;
        }
        case "text": {
          const h = chipsBack(raw).trim();
          if (h.replace(/<[^>]*>/g, "").trim() || /<img/i.test(h)) out.push(`<p>${h}</p>`);
          break;
        }
      }
    }
    return out.join("");
  }, []);

  const emit = useCallback(
    (list: EB[]) => {
      if (emitTimer.current) window.clearTimeout(emitTimer.current);
      emitTimer.current = window.setTimeout(() => onChange(serialize(list)), 300);
    },
    [onChange, serialize],
  );

  const onInput = (id: number) => (e: React.FormEvent<HTMLDivElement>) => {
    htmlRef.current[id] = e.currentTarget.innerHTML;
    emit(blocks);
  };

  const mutate = (next: EB[]) => {
    setBlocks(next);
    emit(next);
  };

  const remove = (idx: number) => mutate(blocks.filter((_, i) => i !== idx));

  const addBlock = (kind: EB["kind"], at: number) => {
    const id = uidRef.current.n++;
    htmlRef.current[id] = "";
    const nextNum = String(blocks.filter((b) => b.kind === "module").length + 1);
    const nb: EB =
      kind === "module" ? { id, kind, num: nextNum } :
      kind === "rules" ? { id, kind, label: "Rules" } :
      ({ id, kind } as EB);
    const next = [...blocks.slice(0, at), nb, ...blocks.slice(at)];
    setAddAt(null);
    mutate(next);
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-tpe="${id}"]`);
      el?.focus();
    });
  };

  const onDrop = (at: number) => {
    if (dragIdx == null) return;
    const next = [...blocks];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(dragIdx < at ? at - 1 : at, 0, moved);
    setDragIdx(null);
    setDropIdx(null);
    mutate(next);
  };

  const editable = (b: EB, cls: string, ph: string, rich = false) => (
    <div
      data-tpe={b.id}
      contentEditable
      suppressContentEditableWarning
      data-ph={ph}
      spellCheck={false}
      className={`outline-none focus:outline-none empty:before:pointer-events-none empty:before:text-muted-foreground/50 empty:before:content-[attr(data-ph)] ${cls}`}
      onInput={onInput(b.id)}
      dangerouslySetInnerHTML={{ __html: htmlRef.current[b.id] ?? "" }}
    />
  );

  const addMenu = (at: number) => (
    <div className="relative flex justify-center">
      <button
        className={`z-10 -my-2 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-opacity hover:text-foreground ${
          addAt === at ? "opacity-100" : "opacity-0 group-hover/gap:opacity-100"
        }`}
        onClick={() => setAddAt(addAt === at ? null : at)}
      >
        <Plus className="h-3 w-3" />
      </button>
      {addAt === at && (
        <div className="absolute top-4 z-30 flex w-[430px] max-w-[90vw] flex-wrap justify-center gap-1 rounded-lg border border-border bg-background p-1.5 shadow-lg">
          {ADDABLE.map((a) => (
            <button
              key={a.kind}
              onClick={() => addBlock(a.kind, at)}
              className="rounded-md px-2.5 py-1 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-muted"
              title={a.hint}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-[820px] pb-16 text-[13px] leading-relaxed" onClick={() => addAt != null && setAddAt(null)}>
      <p className="mb-4 text-[12px] text-muted-foreground">
        Click any block to edit it in place · drag the <GripVertical className="inline h-3 w-3 -translate-y-px" /> handle to reorder · hover between blocks to add one. Save with the button in the top bar.
      </p>

      {blocks.map((b, idx) => (
        <div key={b.id} className="group/gap" onClick={(e) => e.stopPropagation()}>
          {addMenu(idx)}
          {dropIdx === idx && dragIdx != null && <div className="my-1 h-0.5 rounded bg-primary" />}
          <div
            className={`group/blk relative rounded-lg transition-opacity ${dragIdx === idx ? "opacity-40" : ""}`}
            draggable={dragIdx === idx}
            onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; }}
            onDragEnd={() => { setDragIdx(null); setDropIdx(null); }}
            onDragOver={(e) => { if (dragIdx != null) { e.preventDefault(); setDropIdx(idx); } }}
            onDrop={(e) => { e.preventDefault(); onDrop(idx); }}
          >
            {/* rail: drag handle + delete, appear on hover */}
            <div className="absolute -left-14 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover/blk:opacity-100">
              <button
                className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
                onMouseDown={() => setDragIdx(idx)}
                onMouseUp={() => dragIdx === idx && setDragIdx(null)}
                title="Drag to reorder"
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <button
                className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                onClick={() => remove(idx)}
                title="Delete block"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {b.kind === "module" && (
              <div className="mb-1 mt-6 flex items-center gap-2.5 border-t border-border pt-5 group-first/gap:mt-1 group-first/gap:border-t-0 group-first/gap:pt-0">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-foreground text-[12px] font-bold text-background">{b.num || "§"}</span>
                {editable(b, "flex-1 text-[15px] font-bold tracking-tight text-foreground", "Module title…")}
              </div>
            )}
            {b.kind === "section" && (
              <div className="mb-1 mt-4 flex items-center gap-2.5">
                {editable(b, "shrink-0 text-[11.5px] font-bold uppercase tracking-[0.09em] text-foreground/70", "Section title…")}
                <div className="h-px flex-1 bg-border/70" />
              </div>
            )}
            {b.kind === "caption" &&
              editable(b, "mb-0.5 mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-primary/80", "Script label…")}
            {b.kind === "say" && (
              <div className="relative my-2 rounded-xl border border-border bg-card py-3 pl-5 pr-4 shadow-sm before:absolute before:bottom-3 before:left-0 before:top-3 before:w-[3px] before:rounded-full before:bg-primary">
                {editable(
                  b,
                  "text-[14.5px] font-medium leading-[1.6] text-foreground [&_mark]:bg-transparent [&_mark]:text-inherit [&_.tp-ph]:rounded [&_.tp-ph]:bg-primary/10 [&_.tp-ph]:px-1 [&_.tp-ph]:font-semibold [&_.tp-ph]:text-primary",
                  "What the setter says out loud…",
                  true,
                )}
              </div>
            )}
            {b.kind === "direction" && (
              <div className="my-1.5 flex items-center gap-2 pl-5 text-[12px] italic text-muted-foreground">
                <span className="not-italic">⏸</span>
                {editable(b, "flex-1", "Stage direction — e.g. Wait for “Yes”…")}
              </div>
            )}
            {b.kind === "rules" && (
              <div className="my-2 rounded-lg bg-muted/40 px-4 py-2.5">
                <div className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">{b.label}</div>
                {editable(b, "whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted-foreground", "One rule per line…")}
              </div>
            )}
            {b.kind === "text" && editable(b, "my-1.5 text-[13px] text-foreground/80", "Plain text…", true)}
          </div>
        </div>
      ))}

      {/* tail: drop at end + add at end */}
      <div
        className="h-8"
        onDragOver={(e) => { if (dragIdx != null) { e.preventDefault(); setDropIdx(blocks.length); } }}
        onDrop={(e) => { e.preventDefault(); onDrop(blocks.length); }}
      >
        {dropIdx === blocks.length && dragIdx != null && <div className="my-1 h-0.5 rounded bg-primary" />}
      </div>
      <div className="group/gap flex justify-center" onClick={(e) => e.stopPropagation()}>
        <button
          className="flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1 text-[12px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          onClick={() => setAddAt(blocks.length)}
        >
          <Plus className="h-3.5 w-3.5" /> Add block
        </button>
        {addAt === blocks.length && (
          <div className="absolute z-30 mt-8 flex w-[430px] max-w-[90vw] flex-wrap justify-center gap-1 rounded-lg border border-border bg-background p-1.5 shadow-lg">
            {ADDABLE.map((a) => (
              <button
                key={a.kind}
                onClick={() => addBlock(a.kind, blocks.length)}
                className="rounded-md px-2.5 py-1 text-[12px] font-medium text-foreground transition-colors hover:bg-muted"
                title={a.hint}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
