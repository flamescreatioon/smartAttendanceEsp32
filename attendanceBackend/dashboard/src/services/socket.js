import { io } from 'socket.io-client';
import { SOCKET_URL } from './api.js';

export function createSocketClient(token) {
  const currentHostname = typeof window !== 'undefined'
    ? window.location.hostname
    : '';
  const isTunnelHost = /(?:ngrok-free\.app|devtunnels\.ms)$/i.test(currentHostname);
  const isProxyMode = !SOCKET_URL;
  const usePollingOnly = isTunnelHost || isProxyMode;

  return io(SOCKET_URL || undefined, {
    autoConnect: false,
    path: '/socket.io',
    auth: {
      token,
    },
    transports: usePollingOnly ? ['polling'] : ['websocket', 'polling'],
    upgrade: !usePollingOnly,
  });
}
