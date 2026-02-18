import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_TARGET || 'http://localhost:5000';
  const devPort = Number(env.VITE_DEV_PORT) || 3000;
  return {
    plugins: [react()],
    server: {
      port: devPort,
      strictPort: true,
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          secure: false
        },
        '/socket.io': {
          target,
          changeOrigin: true,
          secure: false,
          ws: true
        }
      }
    }
  };
});
