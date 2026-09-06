import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), tailwindcss()],
  publicDir: isSsrBuild ? false : 'public',
  define: { 'import.meta.env.VITE_SITE_ORIGIN': JSON.stringify(process.env.SITE_ORIGIN ?? 'https://nporto.com') },
  optimizeDeps: { include: ['@mlc-ai/web-llm'] },
  server: {
    fs: { deny: ['**/.git/**', '**/archive/**', '**/.env*', '**/.build/native-chrome/**', '**/.build/webmcp-chrome/**'] },
    watch: { ignored: ['**/.build/**', '**/playwright-report/**', '**/test-results/**', '**/docs/evidence/**'] },
  },
  build: {
    manifest: !isSsrBuild,
    sourcemap: false,
    target: 'es2022',
    cssCodeSplit: true,
  },
}));
