import type { FastifyPluginAsync } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { signToken } from '../websocket/middleware.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Guest login — generates a one-time player ID and JWT
  fastify.post('/auth/guest', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 30 },
        },
      },
    },
  }, async (request) => {
    const { name } = request.body as { name: string };
    const playerId = uuidv4();
    const token = signToken({ playerId, name });
    return { playerId, name, token };
  });
};
