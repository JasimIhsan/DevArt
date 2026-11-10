import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./codemirror.css";
import "./index.css";
import { registerPwa } from "./pwa.tsx";

registerPwa();
createRoot(document.getElementById("root")!).render(<App />);
