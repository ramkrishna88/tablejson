import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { EXAMPLE_EXTRACT_RESPONSE } from '../lib/hubResponse.js';

export const EXAMPLE_REQUEST_BODY = {
  file: 'https://tablejson.com/sample-mini.pdf'
} as const;

export async function exampleRoutes(fastify: FastifyInstance) {
  const sendExample = async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.header('Cache-Control', 'no-store');
    return EXAMPLE_EXTRACT_RESPONSE;
  };

  fastify.get('/v1/example', sendExample);
  fastify.post('/v1/example', sendExample);
}
