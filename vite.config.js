import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Vite plugin: relax script-src for the DEV server only.
// The production CSP in index.html is strict (script-src 'self' — no
// unsafe-inline/unsafe-eval). Vite's dev server injects an inline module
// preamble + React refresh code, which strict CSP would block. This plugin
// rewrites the CSP meta ONLY when served by `vite` (dev), never in builds.
function cspDev() {
  return {
    name: 'csp-dev-relax',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace(
        /(script-src\s+'self';)/,
        "script-src 'self' 'unsafe-inline';"
      );
    },
  };
}

// Vite plugin: serves .tmp/auth_info.json at /auth_info.json during dev
// so neutralino-bridge.js can fetch the real NL_TOKEN before init().
function neuAuthProxy() {
  return {
    name: 'neu-auth-proxy',
    configureServer(server) {
      server.middlewares.use('/auth_info.json', (req, res) => {
        const authFile = path.resolve('.tmp/auth_info.json');
        try {
          const data = fs.readFileSync(authFile, 'utf8');
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(data);
        } catch {
          res.statusCode = 404;
          res.end('{}');
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), neuAuthProxy(), cspDev()],
  base: './',
  test: {
    environment: 'jsdom',
    // A few tests drive fake timers through multiple async retry cycles; under
    // CI CPU contention they can exceed the default 5s real-time timeout.
    // Bump the global default to 10s to absorb runner load.
    testTimeout: 10000,
    // Never scan build output or dependencies for test files. dist/ contains a
    // copy of extensions/meridian/keyStorage.test.js (from `neu build`), and
    // running it from dist/ breaks its relative path assertions (ENOENT).
    exclude: ['node_modules/**', 'dist/**', '.vite/**'],
  },
})
