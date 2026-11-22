import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

export default defineConfig(async ({ mode }) => {
  const rootEnvDir = path.resolve(import.meta.dirname, '../..');
  const pkgEnvDir = path.resolve(import.meta.dirname);
  const rootEnv = loadEnv(mode, rootEnvDir, '');
  const pkgEnv = loadEnv(mode, pkgEnvDir, '');
  const env = { ...rootEnv, ...pkgEnv };

  const rawPort = env.PORT || process.env.PORT || '3000';
  const port = Number(rawPort) || 3000;
  const basePath = env.BASE_PATH || process.env.BASE_PATH || '/';

  return {
    base: basePath,
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
        env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      ),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
        env.VITE_SUPABASE_PUBLISHABLE_KEY ||
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
          '',
      ),
      'import.meta.env.VITE_ENABLE_LIVE': JSON.stringify(
        env.VITE_ENABLE_LIVE || process.env.VITE_ENABLE_LIVE || 'false',
      ),
      'import.meta.env.VITE_API_URL': JSON.stringify(
        env.VITE_API_URL || process.env.VITE_API_URL || '',
      ),
    },
    plugins: [
      react(),
      tailwindcss(),
      ...(process.env.REPL_ID !== undefined ? [runtimeErrorOverlay()] : []),
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
    envDir: rootEnvDir,
    build: {
      outDir: path.resolve(import.meta.dirname, 'dist/public'),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: '0.0.0.0',
      allowedHosts: true,
      fs: {
        strict: true,
      },
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
    preview: {
      port,
      host: '0.0.0.0',
      allowedHosts: true,
    },
  };
});
