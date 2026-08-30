import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    // Use relative paths so Electron can load built files from file:// protocol
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'remove-crossorigin',
        enforce: 'post',
        transformIndexHtml: {
          order: 'post',
          handler(html) {
            // Remove all crossorigin attributes added by Vite to local assets
            return html.replace(/\s+crossorigin(="[^"]*")?/g, '');
          }
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          // Public customer/tenant app
          main: path.resolve(__dirname, 'index.html'),
          // Separate provider console (deployed to its own hosting site)
          admin: path.resolve(__dirname, 'admin.html'),
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
