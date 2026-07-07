import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

// The script surface, rebuilt from first principles (docs/AREA-REBUILD.md).
// The editor's HTML is parsed into a MODEL and rendered natively — no iframe,
// no injected CSS fighting inline styles. Empty editor paragraphs and literal
// "•" filler vanish at parse time, so density is structural, not !important.
//
// Heading hierarchy (Andrew: "they're the same exact size and they look the
// same" — they must NOT):
//   module   "Module 5: The Project"   → numbered badge + bold title + rule
//   section  "The Vision & Motivation" → small-caps sub-heading with tail rule
//   caption  "Script (Core Questions)" → tiny colored eyebrow; switches the
//            lane (say vs rules) and labels the block that follows

interface TimelineOpt {
  label: string;
  key: string;
  dq: boolean;
}

export interface TeleprompterProps {
  content: string;
  timeline?: { options: TimelineOpt[] } | null;
}

type RuleItem = { lead: string | null; body: string };

type Block =
  | { kind: "module"; num: string | null; title: string; id: string }
  | { kind: "section"; title: string; id: string }
  | { kind: "caption"; lane: "say" | "rules"; text: string }
  | { kind: "say"; html: string }
  | { kind: "direction"; text: string }
  | { kind: "rules"; label: string; items: RuleItem[] }
  | { kind: "text"; html: string }
  | { kind: "timeline" };

const TIMELINE_TRIGGERS = [/finished by/i, /when do you want/i, /timeline/i, /when are you hoping/i, /how soon/i];

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// [Lead Name]-style placeholders become chips the setter's eye can grab.
const chipPlaceholders = (html: string) =>
  html.replace(/\[([^\]<>]{1,40})\]/g, '<span class="tp-ph">$1</span>');

// Literal "•" typed into the editor is noise here — cards and panels carry
// the structure. Strip them at line starts; whole-bullet lines die upstream.
const stripBullets = (html: string) =>
  html.replace(/(^|<br\s*\/?>|<p>|<li>)\s*[•·▪◦‣]\s*/gi, "$1");

const clean = (raw: string) =>
  raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "");

const stripTags = (s: string) => s.replace(/<[^>]*>/g, "");

function splitLead(t: string): RuleItem {
  const m = t.match(/^([A-Z][\w' -]{1,22}):\s+(.+)$/s);
  return m ? { lead: m[1], body: m[2] } : { lead: null, body: t };
}

function parseScript(content: string, wantTimeline: boolean): Block[] {
  const isHtml = /<p[\s>]|<span|<strong>|<mark>|<h[1-4][\s>]|<ul[\s>]|<ol[\s>]/i.test(content);
  const html = isHtml
    ? clean(content)
    : clean(content)
        .split(/\r?\n/)
        .map((l) => {
          const t = l.trim();
          if (!t) return "";
          if (t.startsWith("**") && t.endsWith("**")) return `<h3>${escapeHtml(t.slice(2, -2))}</h3>`;
          if (t.startsWith("# ")) return `<h3>${escapeHtml(t.slice(2))}</h3>`;
          return `<p>${escapeHtml(t)}</p>`;
        })
        .join("");

  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks: Block[] = [];
  let mode: "say" | "rules" | null = null;
  let rulesLabel = "Coaching";
  let anchorIdx = 0;

  const pushRule = (item: RuleItem) => {
    const last = blocks[blocks.length - 1];
    if (last?.kind === "rules") last.items.push(item);
    else blocks.push({ kind: "rules", label: rulesLabel, items: [item] });
  };

  const pushSay = (el: Element) => {
    if (el.tagName === "UL" || el.tagName === "OL") {
      // A list of spoken questions = one card PER question, never li bullets.
      for (const li of Array.from(el.querySelectorAll("li"))) {
        if ((li.textContent || "").replace(/[•·▪◦‣\s]+/g, "")) {
          blocks.push({ kind: "say", html: chipPlaceholders(stripBullets(li.innerHTML)) });
        }
      }
    } else {
      blocks.push({ kind: "say", html: chipPlaceholders(stripBullets((el as HTMLElement).innerHTML)) });
    }
  };

  const laneCaption = (txt: string): Block | null => {
    const m = txt.match(/^(script|say|rules?|coach(?:ing)?|notes?)\b\s*[:(-]?/i);
    if (!m || txt.length > 60) return null;
    const lane: "say" | "rules" = /^(script|say)/i.test(m[1]) ? "say" : "rules";
    mode = lane;
    const text = txt.replace(/:\s*$/, "");
    if (lane === "rules") rulesLabel = text;
    return { kind: "caption", lane, text };
  };

  for (const el of Array.from(doc.body.children)) {
    const txt = (el.textContent || "").trim();
    const tag = el.tagName;

    if (tag === "HR") continue;
    // Empty paragraphs AND bullet-only filler lines — the gap-makers, gone.
    if (!txt.replace(/[•·▪◦‣\s]+/g, "") && !el.querySelector("img")) continue;

    if (/^H[1-4]$/.test(tag)) {
      const modM = txt.match(/^module\s*(\d+)\s*[:.\-–—]?\s*(.*)$/i);
      if (modM) {
        mode = null;
        rulesLabel = "Coaching";
        blocks.push({ kind: "module", num: modM[1], title: modM[2].trim() || txt, id: `tp-mod-${anchorIdx++}` });
        continue;
      }
      const cap = laneCaption(txt);
      if (cap) { blocks.push(cap); continue; }
      mode = null;
      rulesLabel = "Coaching";
      blocks.push({ kind: "section", title: txt.replace(/:\s*$/, ""), id: `tp-sec-${anchorIdx++}` });
      continue;
    }

    // "Rules:" / "Script:" caption paragraphs — same tier as caption headings.
    if (txt.length < 60 && /^(script|say|rules?|coach(?:ing)?|notes?)\b\s*:?\s*(\(.*\))?$/i.test(txt)) {
      const cap = laneCaption(txt);
      if (cap) { blocks.push(cap); continue; }
    }

    // (Wait for "Yes") — a stage direction, not a spoken line.
    if (/^\(.*\)$/s.test(txt) && txt.length < 160) {
      blocks.push({ kind: "direction", text: txt.replace(/^\(|\)$/g, "") });
      continue;
    }

    const spoken = !!el.querySelector("mark") || mode === "say" || /^["“•·]?\s*["“]/.test(txt);
    if (spoken) { pushSay(el); continue; }

    if (mode === "rules") {
      if (tag === "UL" || tag === "OL") {
        for (const li of Array.from(el.querySelectorAll("li"))) {
          const t = (li.textContent || "").replace(/^[•·▪◦‣\s]+/, "").trim();
          if (t) pushRule(splitLead(t));
        }
      } else {
        pushRule(splitLead(txt.replace(/^[•·▪◦‣\s]+/, "")));
      }
      continue;
    }

    blocks.push({ kind: "text", html: chipPlaceholders(stripBullets((el as HTMLElement).innerHTML)) });
  }

  if (wantTimeline) {
    const at = blocks.findIndex(
      (b) => (b.kind === "say" || b.kind === "text") && TIMELINE_TRIGGERS.some((t) => t.test(stripTags(b.html))),
    );
    if (at !== -1) blocks.splice(at + 1, 0, { kind: "timeline" });
  }
  return blocks;
}

/* ── Timeline DQ — native React, replaces the injected-iframe widget ── */

function TimelineDQ({ options }: { options: TimelineOpt[] }) {
  const [picked, setPicked] = useState<string | null>(null);
  const pickedDq = options.find((o) => o.key === picked)?.dq ?? false;
  return (
    <div className="my-4 rounded-lg border border-amber-200 border-l-[3px] border-l-amber-500 bg-amber-50/70 px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">⊘ Required · Timeline</div>
      <div className="mt-1.5 text-[13px] font-medium text-foreground">"When do you want this finished by?"</div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = picked === o.key;
          return (
            <button
              key={o.key}
              onClick={() => setPicked(o.key)}
              className={`rounded-md border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                on
                  ? o.dq
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-foreground bg-foreground text-background"
                  : o.dq
                    ? "border-red-200 bg-red-50 text-red-700 hover:border-red-300"
                    : "border-border bg-background text-foreground hover:border-foreground/30"
              }`}
            >
              {o.label}
              {o.dq ? " → DQ" : ""}
            </button>
          );
        })}
      </div>
      {pickedDq && (
        <div className="mt-2.5 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Hard disqualifier — timeline exceeds client maximum
        </div>
      )}
    </div>
  );
}

/* ── The teleprompter ──────────────────────────────────────────────── */

// Rich HTML lands via dangerouslySetInnerHTML; these arbitrary-variant
// classes are the entire "theme" — no iframe stylesheet to fight.
const RICH =
  "[&_mark]:bg-transparent [&_mark]:text-inherit [&_strong]:font-semibold " +
  "[&_a]:pointer-events-none [&_a]:text-inherit [&_a]:no-underline [&_img]:max-w-full [&_img]:rounded-lg " +
  "[&_ul]:list-none [&_ol]:list-none [&_li]:my-1 " +
  "[&_.tp-ph]:rounded [&_.tp-ph]:bg-primary/10 [&_.tp-ph]:px-1 [&_.tp-ph]:py-px [&_.tp-ph]:text-[0.92em] [&_.tp-ph]:font-semibold [&_.tp-ph]:text-primary";

export function ScriptTeleprompter({ content, timeline }: TeleprompterProps) {
  const blocks = useMemo(() => parseScript(content, !!timeline), [content, timeline]);
  const rail = useMemo(() => {
    const mods = blocks.filter((b) => b.kind === "module") as Extract<Block, { kind: "module" }>[];
    if (mods.length) return mods.map((m) => ({ id: m.id, num: m.num, title: m.title }));
    const secs = blocks.filter((b) => b.kind === "section") as Extract<Block, { kind: "section" }>[];
    return secs.map((s) => ({ id: s.id, num: null as string | null, title: s.title }));
  }, [blocks]);
  const [active, setActive] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rail.length || !bodyRef.current) return;
    const els = rail
      .map((m) => bodyRef.current?.querySelector(`#${m.id}`))
      .filter(Boolean) as Element[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-10% 0px -75% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [rail]);

  return (
    <div>
      {/* module rail — the call has stages; jump between them mid-call */}
      {rail.length > 1 && (
        <div className="sticky top-0 z-20 -mx-6 border-b border-border bg-background/95 px-6 py-2 backdrop-blur">
          <div className="mx-auto flex max-w-[760px] gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {rail.map((m, i) => (
              <button
                key={m.id}
                onClick={() => document.getElementById(m.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  active === m.id
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="font-bold">{m.num ?? i + 1}</span>
                <span className="max-w-[140px] truncate">{m.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={bodyRef} className="mx-auto max-w-[760px] pb-16 pt-4 text-[13px] leading-relaxed text-foreground/90">
        {blocks.map((b, i) => {
          switch (b.kind) {
            case "module":
              return (
                <div key={i} id={b.id} className="group mb-3 mt-9 scroll-mt-14 first:mt-1">
                  <div className="flex items-center gap-2.5 border-t border-border pt-6 group-first:border-t-0 group-first:pt-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-foreground text-[12px] font-bold text-background">
                      {b.num ?? "§"}
                    </span>
                    <h2 className="text-[15px] font-bold tracking-tight text-foreground">{b.title}</h2>
                  </div>
                </div>
              );
            case "section":
              return (
                <div key={i} id={b.id} className="mb-2 mt-6 flex scroll-mt-14 items-center gap-2.5">
                  <h3 className="shrink-0 text-[11.5px] font-bold uppercase tracking-[0.09em] text-foreground/70">{b.title}</h3>
                  <div className="h-px flex-1 bg-border/70" />
                </div>
              );
            case "caption":
              return b.lane === "say" ? (
                <div key={i} className="mb-1 mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-primary/80">
                  {b.text}
                </div>
              ) : null; // rules captions label their panel instead
            case "say":
              return (
                <div
                  key={i}
                  className={`relative my-2.5 rounded-xl border border-border bg-card py-3 pl-5 pr-4 text-[14.5px] font-medium leading-[1.6] text-foreground shadow-sm before:absolute before:bottom-3 before:left-0 before:top-3 before:w-[3px] before:rounded-full before:bg-primary ${RICH}`}
                  dangerouslySetInnerHTML={{ __html: b.html }}
                />
              );
            case "direction":
              return (
                <div key={i} className="my-2 flex items-center gap-2 pl-5 text-[12px] italic text-muted-foreground">
                  <span className="not-italic">⏸</span> {b.text}
                </div>
              );
            case "rules":
              return (
                <div key={i} className="my-3 rounded-lg bg-muted/40 px-4 py-2.5">
                  <div className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">{b.label}</div>
                  <ul className="space-y-1">
                    {b.items.map((r, j) => (
                      <li key={j} className="flex gap-2 text-[12.5px] leading-snug text-muted-foreground">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                        <span>
                          {r.lead && <span className="font-semibold text-foreground/80">{r.lead}: </span>}
                          {r.body}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            case "timeline":
              return <TimelineDQ key={i} options={timeline?.options ?? []} />;
            case "text":
              return (
                <div
                  key={i}
                  className={`my-2 text-[13px] leading-relaxed text-foreground/80 ${RICH}`}
                  dangerouslySetInnerHTML={{ __html: b.html }}
                />
              );
          }
        })}
      </div>
    </div>
  );
}
