import type { FastifyPluginAsync } from 'fastify';
import type { TableManager } from '../table/TableManager.js';

export function tableRoutes(tables: TableManager): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/tables', async () => {
      return { tables: tables.listTables() };
    });

    fastify.post('/tables', {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 50 },
            smallBlind: { type: 'number', minimum: 1 },
            bigBlind: { type: 'number', minimum: 2 },
            maxPlayers: { type: 'number', minimum: 2, maximum: 9 },
            minBuyIn: { type: 'number', minimum: 1 },
            maxBuyIn: { type: 'number', minimum: 1 },
            chipDenominations: {
              type: 'array',
              items: { type: 'number', minimum: 1 },
              minItems: 1,
              maxItems: 8,
            },
            maxHands: { type: 'number', minimum: 0 },
          },
        },
      },
    }, async (request, reply) => {
      const { name, ...config } = request.body as {
        name: string;
        smallBlind?: number;
        bigBlind?: number;
        maxPlayers?: number;
        minBuyIn?: number;
        maxBuyIn?: number;
        chipDenominations?: number[];
        maxHands?: number;
      };
      if (tables.isNameTaken(name.trim())) {
        return reply.status(409).send({ error: '该牌桌名称已存在，请使用不同的名称' });
      }
      const tableId = tables.createTable(name.trim(), config);
      return { tableId };
    });
  };
}
