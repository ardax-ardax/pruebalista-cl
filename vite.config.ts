import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const cloudEnvFallbacks = {
  VITE_SUPABASE_PROJECT_ID: "ddhrrgsejpebblarzmsj",
  VITE_SUPABASE_URL: "https://ddhrrgsejpebblarzmsj.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkaHJyZ3NlanBlYmJsYXJ6bXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjE0NjEsImV4cCI6MjA5MjU5NzQ2MX0.56bISzsRZCo7fPwgFkDAdtc0Ym3Gp61ax-_W_dgP5Bg",
} as const;

const envDefineFallbacks = Object.fromEntries(
  Object.entries(cloudEnvFallbacks).map(([key, value]) => [
    `import.meta.env.${key}`,
    JSON.stringify(process.env[key] ?? value),
  ]),
);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  define: envDefineFallbacks,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
