import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { isFileTooLargeError, isNotMultipartError } from './lib/errors.js';
import { extractRoutes } from './routes/extract.js';
import { exampleRoutes } from './routes/example.js';
import { healthRoutes } from './routes/health.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://tablejson.com';
const CANONICAL_HOST = 'tablejson.com';
const invokedDirectly = Boolean(
  process.argv[1] && path.resolve(process.argv[1]) === __filename
);

const fastify = Fastify({
  logger: invokedDirectly && process.env.TABLEJSON_NO_LISTEN !== '1',
  trustProxy: true,
  requestTimeout: 180_000
});

await fastify.register(compress, {
  global: true,
  encodings: ['gzip', 'deflate']
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

fastify.addHook('onSend', async (request, reply) => {
  const proto = String(request.headers['x-forwarded-proto'] || request.protocol || '');
  if (proto.split(',')[0].trim() === 'https') {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
});

// www → apex and http → https. /ads.txt on the apex stays a 200, including
// when x-forwarded-proto is http, so the ads.txt crawler is not redirected
// off the file it came to fetch.
fastify.addHook('onRequest', (request, reply, done) => {
  const target = canonicalRedirectTarget(
    request.headers.host,
    request.headers['x-forwarded-proto'],
    request.raw.url || '/'
  );
  if (target) {
    reply.header('Cache-Control', 'public, max-age=3600');
    reply.redirect(target, 301);
    return;
  }
  done();
});

export function canonicalRedirectTarget(
  hostHeader: string | string[] | undefined,
  forwardedProto: string | string[] | undefined,
  rawUrl: string
): string | null {
  const host = String(Array.isArray(hostHeader) ? hostHeader[0] : hostHeader || '')
    .toLowerCase()
    .replace(/:\d+$/, '');
  const isWww = host === `www.${CANONICAL_HOST}`;
  const isApex = host === CANONICAL_HOST;
  if (!isWww && !isApex) {
    return null;
  }

  const qIndex = rawUrl.indexOf('?');
  const pathOnly = qIndex === -1 ? rawUrl : rawUrl.slice(0, qIndex);
  const query = qIndex === -1 ? '' : rawUrl.slice(qIndex);
  if (isApex && pathOnly === '/ads.txt') {
    return null;
  }

  const forwarded = String(Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const normalizedPath = pathOnly === '/home' || pathOnly === '/home/' ? '/' : pathOnly;
  if (!isWww && forwarded !== 'http') {
    return null;
  }
  return `https://${CANONICAL_HOST}${normalizedPath}${query}`;
}

fastify.get('/ads.txt', async (_request, reply) => {
  const body = fs.readFileSync(path.join(__dirname, 'public', 'ads.txt'), 'utf8');
  return reply
    .header('Content-Type', 'text/plain')
    .header('Cache-Control', 'public, max-age=0, must-revalidate')
    .header('x-no-compression', 'true')
    .send(body);
});

fastify.get('/.well-known/security.txt', async (_request, reply) => {
  const body = fs.readFileSync(path.join(__dirname, 'public', '.well-known', 'security.txt'), 'utf8');
  return reply
    .type('text/plain; charset=utf-8')
    .header('Cache-Control', 'public, max-age=86400')
    .header('x-no-compression', 'true')
    .send(body);
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
  prefix: '/',
  dotfiles: 'allow',
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      return;
    }
    if (filePath.endsWith('.webmanifest')) {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return;
    }
    if (filePath.endsWith('.ico')) {
      res.setHeader('Content-Type', 'image/x-icon');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return;
    }
    if (filePath.endsWith('.png')) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
});

const sitePages = ['about', 'privacy', 'contact', 'terms', 'docs', 'how-it-works', 'faq'] as const;
for (const page of sitePages) {
  fastify.get(`/${page}`, async (_request, reply) => reply.sendFile(`${page}.html`));
}
fastify.get('/docs/example', async (_request, reply) => reply.sendFile('docs-example.html'));

export const guideSlugs = [
  'extracting-tables-from-pdf-to-json',
  'invoice-pdf-to-excel-and-csv',
  'text-layer-vs-scanned-pdfs',
  'cleaning-messy-table-json',
  'bank-statement-pdfs-to-spreadsheets',
  'json-vs-csv-for-table-data',
  'automate-pdf-table-extraction'
] as const;

fastify.get('/guides', async (_request, reply) => reply.sendFile('guides/index.html'));
fastify.get('/guides/', async (_request, reply) => reply.redirect('/guides', 301));
for (const slug of guideSlugs) {
  fastify.get(`/guides/${slug}`, async (_request, reply) => reply.sendFile(`guides/${slug}.html`));
}

fastify.get('/home', async (request, reply) => {
  const url = request.raw.url || '/home';
  const query = url.includes('?') ? url.slice(url.indexOf('?')) : '';
  return reply.redirect(`/${query}`, 301);
});

const notFoundHtml = fs.readFileSync(path.join(__dirname, 'public', '404.html'), 'utf8');
fastify.setNotFoundHandler((request, reply) => {
  const pathOnly = (request.raw.url || '/').split('?')[0];
  const accept = String(request.headers.accept || '');
  const apiRoute = pathOnly === '/v1' || pathOnly.startsWith('/v1/');
  if (apiRoute || !accept.includes('text/html')) {
    return reply.status(404).type('application/json; charset=utf-8').send({
      status: 'error',
      error_code: 'NOT_FOUND',
      message: 'Not found.'
    });
  }
  return reply
    .status(404)
    .type('text/html; charset=utf-8')
    .header('Cache-Control', 'no-store')
    .send(notFoundHtml);
});

// Register API Routes
await fastify.register(healthRoutes);
await fastify.register(exampleRoutes);
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
        url: 'https://tablejson.com',
        email: 'hello@tablejson.com'
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
      securitySchemes: {}
    },
    security: [],
    paths: {
      '/v1/extract-tables': {
        post: {
          summary: 'Extract Tables from PDF File',
          description: 'Upload a text-layer PDF as multipart/form-data field "file". Live calls return every row, plus page_number, page_end, and total_pages. RapidAPI Hub testers can run GET /v1/example for a 2-row sample that will not freeze Chrome. Small PDF: https://tablejson.com/sample-mini.pdf',
          security: [],
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
                      description: 'PDF file to process. Use https://tablejson.com/sample-mini.pdf in the Hub playground.'
                    }
                  },
                  required: ['file']
                }
              },
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    file: {
                      type: 'string',
                      format: 'uri',
                      description: 'Public PDF URL. Zapier and webhooks can send this instead of a multipart upload.',
                      example: 'https://tablejson.com/sample-mini.pdf'
                    }
                  },
                  required: ['file']
                },
                example: {
                  file: 'https://tablejson.com/sample-mini.pdf'
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
                      filename: { type: 'string', example: 'example.pdf' },
                      total_pages: { type: 'number', example: 1 },
                      tables_found: { type: 'number', example: 1 },
                      metadata: { type: 'object' },
                      tables: { type: 'array' }
                    },
                    example: {
                      status: 'success',
                      filename: 'example.pdf',
                      total_pages: 1,
                      tables_found: 1,
                      metadata: { execution_time_ms: 12, extraction_mode: 'text' },
                      tables: [
                        {
                          table_id: 1,
                          page_number: 1,
                          page_end: 1,
                          headers: ['date', 'item', 'amount'],
                          total_rows: 2,
                          rows: [
                            {
                              row_index: 1,
                              data: { date: '2026-01-05', item: 'Hosting', amount: '1250.00' },
                              raw_cells: ['2026-01-05', 'Hosting', '1250.00']
                            },
                            {
                              row_index: 2,
                              data: { date: '2026-01-12', item: 'Licenses', amount: '4500.00' },
                              raw_cells: ['2026-01-12', 'Licenses', '4500.00']
                            }
                          ]
                        }
                      ]
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
      '/v1/invoice-xlsx': {
        post: {
          summary: 'Invoice PDF to checksummed Excel',
          description: 'Upload a text-layer invoice PDF. Default response is an .xlsx workbook. Add ?format=json for the checksum preview (vendor, invoice number, totals, line checks). FAIL still returns the file. RapidAPI Hub testers should run GET /v1/invoice-example first. Sample: https://tablejson.com/sample-invoice.pdf',
          security: [],
          parameters: [
            {
              name: 'format',
              in: 'query',
              required: false,
              schema: {
                type: 'string',
                enum: ['json', 'xlsx']
              },
              description: 'json returns the checksum preview. Omit or xlsx downloads the workbook.'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    file: { type: 'string', format: 'binary' }
                  },
                  required: ['file']
                }
              },
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    file: {
                      type: 'string',
                      format: 'uri',
                      example: 'https://tablejson.com/sample-invoice.pdf'
                    }
                  },
                  required: ['file']
                },
                example: {
                  file: 'https://tablejson.com/sample-invoice.pdf'
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Excel workbook, or JSON preview when format=json'
            }
          }
        }
      },
      '/v1/invoice-example': {
        get: {
          summary: 'Example invoice checksum JSON',
          description: 'Returns a tiny invoice checksum sample so RapidAPI Hub testers can click Run without downloading Excel. Prefer this before POST /v1/invoice-xlsx.',
          security: [],
          responses: {
            '200': {
              description: 'Static invoice checksum JSON'
            }
          }
        },
        post: {
          summary: 'Example invoice checksum JSON',
          description: 'Same canned invoice checksum as GET /v1/invoice-example. The body is ignored so Hub Run stays fast.',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    file: {
                      type: 'string',
                      format: 'uri',
                      example: 'https://tablejson.com/sample-invoice.pdf'
                    }
                  },
                  required: ['file']
                },
                example: {
                  file: 'https://tablejson.com/sample-invoice.pdf'
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Static invoice checksum JSON'
            }
          }
        }
      },
      '/v1/example': {
        get: {
          summary: 'Example extract response',
          description: 'Returns a tiny 2-row JSON example so RapidAPI Hub testers can click Run without uploading a PDF or freezing the tab. Prefer POST /v1/example if you want a visible JSON body.',
          security: [],
          responses: {
            '200': {
              description: 'Static example table JSON'
            }
          }
        },
        post: {
          summary: 'Example extract response',
          description: 'Same tiny 2-row JSON as GET /v1/example, with a JSON body so the Hub Body tab is not empty. The body is a public mini PDF URL. This does not parse the PDF, so Run stays fast.',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    file: {
                      type: 'string',
                      format: 'uri',
                      example: 'https://tablejson.com/sample-mini.pdf'
                    }
                  },
                  required: ['file']
                },
                example: {
                  file: 'https://tablejson.com/sample-mini.pdf'
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Static example table JSON'
            }
          }
        }
      },
      '/v1/health': {
        get: {
          summary: 'Health Check',
          description: 'No file or extra headers required. Use this to confirm the Hub playground can show a Response.',
          security: [],
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

    // Do not warmup pdf-parse here. A failed warmup corrupts its global parser
    // and later extracts return EXTRACTION_FAILED / bad XRef.
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

export { fastify };

if (invokedDirectly && process.env.TABLEJSON_NO_LISTEN !== '1') {
  start();
}
