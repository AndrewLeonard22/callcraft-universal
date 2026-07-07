import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// One-time cleanup: the Mapbox pipeline is gone (maps are keyless Google now).
// Drop any dead token cached in old browsers. Harmless if never set.
try { localStorage.removeItem("MAPBOX_PUBLIC_TOKEN"); } catch { /* SSR / disabled storage */ }

createRoot(document.getElementById("root")!).render(<App />);
