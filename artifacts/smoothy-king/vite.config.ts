import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

/**
 * The port the dev and preview servers listen on.
 *
 * Resolved lazily, because a build has no port. Validating it at config load
 * made `vite build` fail with "PORT environment variable is required" — a dev
 * server concern leaking into a path that never starts one, which is exactly
 * the kind of thing that only shows up the first time someone tries to
 * produce a production image.
 *
 * Still required, and still validated, wherever a server is actually started.
 */
function devServerPort(): number {
  const raw = process.env.PORT;

  if (!raw) {
    throw new Error(
      'PORT environment variable is required but was not provided.',
    );
  }

  const port = Number(raw);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${raw}"`);
  }

  return port;
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

// Async because the Replit plugins are loaded with a top-level `await`; the
// function form is what lets the port stay a serve-only concern.
export default defineConfig(async ({ command }) => ({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    // Only touched when serving; `build` never reads it.
    port: command === 'serve' ? devServerPort() : undefined,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        // Env-driven so the same config works under Replit (default) and in
        // docker compose, where the API is a service name rather than
        // localhost. Default is the previous hard-coded value, so nothing
        // changes for anyone not setting it.
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:5000',
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
    },
  },
  preview: {
    port: command === 'serve' ? devServerPort() : undefined,
    host: '0.0.0.0',
    allowedHosts: true,
  },
}));
