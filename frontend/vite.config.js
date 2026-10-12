import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// VITE_BASE is "/<repo>/" on GitHub project pages, "/" everywhere else.
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
});
