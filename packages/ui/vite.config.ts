import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Read by Storybook's react-vite builder, so Tailwind runs for stories. The package ships source; nothing is bundled.
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
