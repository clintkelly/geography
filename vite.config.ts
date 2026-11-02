import { appendFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/** In development, the game posts its errors here and they land in game-errors.log, which git ignores. */
const errorLog = (): Plugin => ({
  name: 'error-log',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__error', (req, res) => {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString().slice(0, 20000); });
      req.on('end', () => {
        appendFileSync('game-errors.log', `${new Date().toISOString()} ${body}\n`);
        res.statusCode = 204;
        res.end();
      });
    });
  },
});

export default defineConfig({
  plugins: [react(), errorLog()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
