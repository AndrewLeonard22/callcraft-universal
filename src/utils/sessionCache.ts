// Session-scoped caches that make revisits instant — the "as fast as Relay" layer.
//
// Two universal sins this kills:
//  1. Every page burned 2 sequential round-trips (auth.getUser → organization_members)
//     before fetching ANY content. resolveOrgId() pays that once per session.
//  2. Every page threw a full-screen spinner on every visit, refetching data it had
//     seconds ago. pageCache lets a page seed its state instantly from the last visit
//     and refresh quietly behind (stale-while-revalidate — same pattern as Relay).
//
// Cache is module-level: it lives for the browser session, resets on hard refresh.

import { supabase } from "@/integrations/supabase/client";

let orgIdPromise: Promise<string | null> | null = null;

/** Resolve the signed-in user's organization id — cached + deduped for the session. */
export function resolveOrgId(): Promise<string | null> {
  if (!orgIdPromise) {
    orgIdPromise = (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();
      return data?.organization_id ?? null;
    })().catch(() => {
      orgIdPromise = null; // failed resolves don't poison the session
      return null;
    });
  }
  return orgIdPromise;
}

/** Reset on sign-out so the next user never sees the previous session's org. */
export function clearSessionCache() {
  orgIdPromise = null;
  pageStore.clear();
}

const pageStore = new Map<string, unknown>();

/** Last-known page data from this session, or null on true-first-visit. */
export function getPage<T>(key: string): T | null {
  return (pageStore.get(key) as T) ?? null;
}

/** Stash page data after a successful load so the next visit paints instantly. */
export function setPage<T>(key: string, data: T): void {
  pageStore.set(key, data);
}

/** Merge a partial update into a stashed page object (for multi-fetch pages). */
export function mergePage<T extends object>(key: string, partial: Partial<T>): void {
  pageStore.set(key, { ...(pageStore.get(key) as T | undefined), ...partial });
}
