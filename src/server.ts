import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { isFileTooLargeError, isNotMultipartError } from './lib/errors.js';
import { extractRoutes } from './routes/extract.js';
import { healthRoutes } from './routes/health.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://pdf-table-extractor-api-production.up.railway.app';

const fastify = Fastify({
  logger: true
});

await fastify.register(cors, {
  origin: true
});

await fastify.register(rateLimit, {
  global: false,
  errorResponseBuilder: (_request, context) => ({
    status: 'error',
    error_code: 'RATE_LIMITED',
    message: `Too many requests. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
    retry_after_seconds: Math.ceil(context.ttl / 1000)
  })
});

await fastify.register(multipart, {
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES
  }
});

fastify.setErrorHandler((error, request, reply) => {
  if (isFileTooLargeError(error)) {
    return reply.status(413).send({
      status: 'error',
      error_code: 'FILE_TOO_LARGE',
      message: `The uploaded PDF exceeds the maximum API limit of ${(MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0)} MB.`,
      max_limit_mb: MAX_FILE_SIZE_BYTES / (1024 * 1024)
    });
  }

  if (isNotMultipartError(error)) {
    return reply.status(400).send({
      status: 'error',
      error_code: 'NOT_MULTIPART',
      message: 'This endpoint requires multipart/form-data with a PDF file field named "file".'
    });
  }

  request.log.error(error);
  const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 500
    ? error.statusCode
    : 500;
  return reply.status(statusCode).send({
    status: 'error',
    error_code: statusCode < 500 ? 'BAD_REQUEST' : 'INTERNAL_ERROR',
    message: statusCode < 500 ? (error.message || 'Bad request') : 'An internal error occurred.'
  });
});

// Serve Public Static Playground UI
await fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
  prefix: '/'
});

// Register API Routes
await fastify.register(healthRoutes);
await fastify.register(extractRoutes);

// Export OpenAPI JSON for RapidAPI import
fastify.get('/openapi.json', async () => {
  return {
    openapi: '3.0.3',
    info: {
      title: 'TableJSON — PDF Table to JSON',
      description: 'Upload a text-layer PDF (up to 500MB) and receive structured tables as JSON. Digital PDFs only — scanned or image-only files are not OCR’d. Playground: https://tablejson.com',
      version: '1.0.0',
      contact: {
        name: 'TableJSON',
        url: 'https://tablejson.com'
      },
      'x-category': 'Data',
      'x-website': 'https://tablejson.com'
    },
    servers: [
      {
        url: PUBLIC_BASE_URL,
        description: 'Production'
      },
      {
        url: 'http://localhost:3000',
        description: 'Local Server'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key'
        },
        RapidApiProxySecret: {
          type: 'apiKey',
          in: 'header',
          name: 'X-RapidAPI-Proxy-Secret'
        }
      }
    },
    security: [
      { ApiKeyAuth: [] },
      { RapidApiProxySecret: [] }
    ],
    paths: {
      '/v1/extract-tables': {
        post: {
          summary: 'Extract Tables from PDF File',
          description: 'Upload a text-layer PDF (up to 500MB). The file is streamed to disk, then parsed. Scanned/image-only PDFs are not OCR\'d.',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    file: {
                      type: 'string',
                      format: 'binary',
                      description: 'PDF File to process'
                    }
                  },
                  required: ['file']
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Successful extraction',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'success' },
                      filename: { type: 'string', example: 'large_ledger.pdf' },
                      total_pages: { type: 'number', example: 50 },
                      tables_found: { type: 'number', example: 2 },
                      metadata: { type: 'object' },
                      tables: { type: 'array' }
                    }
                  }
                }
              }
            },
            '400': {
              description: 'Missing file, invalid type, empty file, or request is not multipart/form-data'
            },
            '401': {
              description: 'Missing or invalid API key'
            },
            '413': {
              description: 'Payload Too Large'
            },
            '429': {
              description: 'Rate limited'
            }
          }
        }
      },
      '/v1/health': {
        get: {
          summary: 'Health Check',
          responses: {
            '200': {
              description: 'System Status'
            }
          }
        }
      }
    }
  };
});

// Start Server
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`\n🚀 PDF Table Extractor API is running at: http://localhost:${PORT}`);
    console.log(`🌐 Interactive Web UI Playground: http://localhost:${PORT}/`);
    console.log(`📋 OpenAPI Spec for RapidAPI: http://localhost:${PORT}/openapi.json\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
