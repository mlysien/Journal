import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Lock down the packaged renderer. Skipped in dev, where Vite injects inline scripts. */
const csp = (): Plugin => ({
  name: 'csp',
  apply: 'build',
  transformIndexHtml: html => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: vault:">`),
});

export default defineConfig({
  base: './',
  plugins: [react(), csp()],
  // Packaging writes into release/; without this the dev window reloads while it does.
  server: { port: 5173, strictPort: true, watch: { ignored: ['**/release/**', '**/dist-electron/**'] } },
});
