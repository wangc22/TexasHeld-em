import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface AuthPayload {
  playerId: string;
  name: string;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '24h' });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as AuthPayload;
  } catch {
    return null;
  }
}

/** Socket.io middleware: attaches playerId to socket.data */
export function authMiddleware(
  socket: { handshake: { auth: Record<string, unknown> }; data: Record<string, unknown> },
  next: (err?: Error) => void
): void {
  const token = socket.handshake.auth['token'] as string | undefined;
  if (!token) {
    next(new Error('MISSING_TOKEN'));
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    next(new Error('INVALID_TOKEN'));
    return;
  }
  socket.data['playerId'] = payload.playerId;
  socket.data['playerName'] = payload.name;
  next();
}
