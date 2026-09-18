import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Konfigurasi HMR agar kompatibel dengan reverse proxy/cloud AI Studio
      hmr: process.env.DISABLE_HMR === 'true'
        ? false
        : {
            clientPort: 443,
          },
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
