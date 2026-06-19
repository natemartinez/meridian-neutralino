import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

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
  plugins: [react(), neuAuthProxy()],
  base: './',
})
