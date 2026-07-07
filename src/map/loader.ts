// One Maps JS loader for the whole app — thin, typed, singleton.
// js-api-loader is PINNED ^1 (v2 deleted the Loader class; see 0875cf2).
import { Loader } from "@googlemaps/js-api-loader";

// Publishable browser key (referrer-restricted in Google console — that's the
// security control for Maps keys, not secrecy). Env overrides when present.
export const MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ||
  "AIzaSyC4bx-C9vGvC0JEdRnd4B78Uvmhq6YtkbU";

// A vector Map ID unlocks tilt + AdvancedMarkerElement.
export const MAP_ID =
  (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined) || "DEMO_MAP_ID";

type LoaderWithImport = Loader & { importLibrary: (name: string) => Promise<any> }; // eslint-disable-line @typescript-eslint/no-explicit-any

let singleton: LoaderWithImport | null = null;

export function importLibrary<T = unknown>(name: string): Promise<T> {
  if (!singleton) {
    singleton = new Loader({ apiKey: MAPS_API_KEY, version: "weekly" }) as LoaderWithImport;
  }
  return singleton.importLibrary(name) as Promise<T>;
}

/** Idle-preload the heavy libraries so the Area tab opens hot. */
export function preloadMapLibraries(): void {
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1200));
  idle(() => {
    void importLibrary("maps").catch(() => {});
    void importLibrary("streetView").catch(() => {});
    void importLibrary("places").catch(() => {});
    void importLibrary("maps3d").catch(() => {});
  });
}
