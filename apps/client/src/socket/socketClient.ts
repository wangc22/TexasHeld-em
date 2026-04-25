import { io, Socket } from 'socket.io-client';
import { apiBaseUrl } from '../config/env.js';

// 单例 socket，不允许替换，只更新 auth 并重连
// 这样 useSocketEvents 注册的监听器永远不会丢失
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('poker_token');
    socket = io(apiBaseUrl, {
      auth: { token: token ?? '' },
      autoConnect: !!token, // 有 token 就立即连接
    });
  }
  return socket;
}

/**
 * 登录后调用：更新认证 token 并确保连接。
 * 复用同一个 socket 实例，保留已注册的所有事件监听器。
 */
export function connectSocket(token: string): Socket {
  const s = getSocket();
  // 更新 auth token
  s.auth = { token };
  // 如果当前未连接则连接
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
