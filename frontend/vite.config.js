import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // ... 其他原本的設定
  server: {
    allowedHosts: ['booka-link.onrender.com']
  }
})
