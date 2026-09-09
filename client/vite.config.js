import path from 'path';
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../server');

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Read the API port straight from server/.env so the proxy always points at
  // the port the Express server is actually listening on. Defaults to 5000.
  // Set PORT in server/.env if 5000 is taken (on macOS the AirPlay Receiver
  // in Control Center listens on 5000 unless you turn it off).
  const { PORT } = loadEnv(mode, serverDir, '');
  const apiPort = PORT || 5000;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      // Forward /api/* to the Express server so no CORS setup is needed in development
      proxy: {
        '/api': {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
