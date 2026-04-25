export const config = {
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  turnTimeoutMs: 30_000,
  botThinkMinMs: 2_000,  // minimum artificial delay for bot actions (2-3s range)
  botThinkMaxMs: 3_000,
  botApiTimeoutMs: 8_000,
  disconnectGracePeriodMs: 60_000,
} as const;
