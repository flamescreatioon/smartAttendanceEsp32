import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const tunnelHost = env.VITE_DEV_TUNNEL_HOST || env.DEV_TUNNEL_HOST || ''
  const backendProxyTarget = env.VITE_BACKEND_PROXY_TARGET || 'http://127.0.0.1:3000'

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        '.devtunnels.ms',
        '.ngrok-free.app',
        ...(tunnelHost ? [tunnelHost] : []),
      ],
      ...(tunnelHost
        ? {
          hmr: {
            protocol: 'wss',
            host: tunnelHost,
            clientPort: 443,
          },
        }
        : {}),
      proxy: {
        '/api': {
          target: backendProxyTarget,
          changeOrigin: true,
        },
        '/socket.io': {
          target: backendProxyTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  }
})
