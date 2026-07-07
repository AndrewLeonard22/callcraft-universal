import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// One-time cleanup: the Mapbox pipeline is gone (all maps are keyless Google now).
// A dead token could still be cached in browsers from the old code path — drop it
// so nothing keeps trying to use it. Harmless if the key was never set.
try { localStorage.removeItem("MAPBOX_PUBLIC_TOKEN"); } catch { /* SSR / disabled storage */ }

createRoot(document.getElementById("root")!).render(<App />);
