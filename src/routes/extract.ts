import { readFile } from 'node:fs/promises';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { requireExtractAuth } from '../lib/apiAuth.js';
import { isNotMultipartError } from '../lib/errors.js';
import { extractTablesFromPDF } from '../services/pdfExtractor.js';

async function rejectIfNotMultipart(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.isMultipart()) {
    return reply.status(400).send({
      status: 'error',
      error_code: 'NOT_MULTIPART',
      message: 'This endpoint requires multipart/form-data with a PDF file field named "file".'
    });
  }
}

export async function extractRoutes(fastify: FastifyInstance) {
  fastify.get('/v1/extract-tables', async (request: FastifyRequest, reply: FastifyReply) => {
    const accept = String(request.headers.accept || '');
    if (accept.includes('text/html')) {
      return reply.redirect('/');
    }

    return reply.status(405).send({
      status: 'error',
      error_code: 'METHOD_NOT_ALLOWED',
      message: 'This endpoint only accepts POST multipart/form-data with a PDF in the "file" field.',
      playground: 'https://tablejson.com',
      docs: 'https://tablejson.com/openapi.json',
      method: 'POST',
      path: '/v1/extract-tables'
    });
  });

  fastify.post('/v1/extract-tables', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute'
      }
    },
    preHandler: [rejectIfNotMultipart, requireExtractAuth]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const files = await request.saveRequestFiles();
      const uploaded = files.find((file) => file.fieldname === 'file') ?? files[0];

      if (!uploaded) {
        return reply.status(400).send({
          status: 'error',
          error_code: 'NO_FILE_UPLOADED',
          message: 'Please upload a valid PDF file using multipart/form-data field name "file".'
        });
      }

      const filename = uploaded.filename || 'uploaded.pdf';
      if (uploaded.mimetype !== 'application/pdf' && !filename.toLowerCase().endsWith('.pdf')) {
        return reply.status(400).send({
          status: 'error',
          error_code: 'INVALID_FILE_TYPE',
          message: 'Only PDF files (application/pdf) are supported.'
        });
      }

      const buffer = await readFile(uploaded.filepath);
      if (buffer.length === 0) {
        return reply.status(400).send({
          status: 'error',
          error_code: 'EMPTY_FILE',
          message: 'Uploaded PDF file is empty.'
        });
      }

      const extractionResult = await extractTablesFromPDF(buffer, filename);
      return reply.status(200).send(extractionResult);
    } catch (error: unknown) {
      if (isNotMultipartError(error)) {
        return reply.status(400).send({
          status: 'error',
          error_code: 'NOT_MULTIPART',
          message: 'This endpoint requires multipart/form-data with a PDF file field named "file".'
        });
      }

      request.log.error(error);
      return reply.status(500).send({
        status: 'error',
        error_code: 'EXTRACTION_FAILED',
        message: 'An internal error occurred while processing the PDF file.'
      });
    }
  });
}
