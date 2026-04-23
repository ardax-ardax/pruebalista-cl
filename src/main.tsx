import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ensureStorageReady } from "./lib/assessment-storage";

ensureStorageReady().finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
