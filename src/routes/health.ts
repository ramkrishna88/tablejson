import { FastifyInstance } from 'fastify';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/v1/health', async () => {
    return {
      status: 'healthy',
      service: 'PDF Table Extractor API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime_seconds: process.uptime()
    };
  });
}
