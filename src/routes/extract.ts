import { readFile } from 'node:fs/promises';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { requireExtractAuth } from '../lib/apiAuth.js';
import { isNotMultipartError } from '../lib/errors.js';
import { extractTablesFromPDF } from '../services/pdfExtractor.js';

const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;

type ExtractBody = {
  file?: unknown;
};

function fileUrlFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const file = (body as ExtractBody).file;
  if (typeof file !== 'string') {
    return undefined;
  }

  const trimmed = file.trim();
  return isAllowedPdfUrl(trimmed) ? trimmed : undefined;
}

function isAllowedPdfUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host === '169.254.169.254' ||
    host === 'metadata.google.internal'
  ) {
    return false;
  }

  if (/^(127|10|0)\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) {
    return false;
  }

  return true;
}

function filenameFromUrl(fileUrl: string): string {
  try {
    const pathname = new URL(fileUrl).pathname;
    const name = decodeURIComponent(pathname.split('/').filter(Boolean).pop() || '');
    return name.toLowerCase().endsWith('.pdf') ? name : 'download.pdf';
  } catch {
    return 'download.pdf';
  }
}

async function downloadPdfFromUrl(fileUrl: string): Promise<{ buffer: Buffer; filename: string }> {
  const response = await fetch(fileUrl, {
    redirect: 'follow',
    headers: {
      Accept: 'application/pdf,*/*'
    }
  });

  if (!response.ok) {
    throw Object.assign(new Error(`Could not download PDF (${response.status}).`), { statusCode: 400 });
  }

  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_DOWNLOAD_BYTES) {
    throw Object.assign(new Error('The PDF URL is larger than the 50 MB download limit.'), { statusCode: 413 });
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length === 0) {
    throw Object.assign(new Error('The PDF URL returned an empty file.'), { statusCode: 400 });
  }
  if (buffer.length > MAX_DOWNLOAD_BYTES) {
    throw Object.assign(new Error('The PDF URL is larger than the 50 MB download limit.'), { statusCode: 413 });
  }

  return { buffer, filename: filenameFromUrl(fileUrl) };
}

async function rejectIfMissingSource(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (request.isMultipart() || fileUrlFromBody(request.body)) {
    return;
  }

  return reply.status(400).send({
    status: 'error',
    error_code: 'NOT_MULTIPART',
    message: 'Send a PDF as multipart/form-data field "file", or JSON {"file":"https://example.com/file.pdf"}.'
  });
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
    preHandler: [rejectIfMissingSource, requireExtractAuth]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      let buffer: Buffer;
      let filename: string;

      if (request.isMultipart()) {
        const files = await request.saveRequestFiles();
        const uploaded = files.find((file) => file.fieldname === 'file') ?? files[0];

        if (!uploaded) {
          return reply.status(400).send({
            status: 'error',
            error_code: 'NO_FILE_UPLOADED',
            message: 'Please upload a valid PDF file using multipart/form-data field name "file".'
          });
        }

        filename = uploaded.filename || 'uploaded.pdf';
        if (uploaded.mimetype !== 'application/pdf' && !filename.toLowerCase().endsWith('.pdf')) {
          return reply.status(400).send({
            status: 'error',
            error_code: 'INVALID_FILE_TYPE',
            message: 'Only PDF files (application/pdf) are supported.'
          });
        }

        buffer = await readFile(uploaded.filepath);
      } else {
        const fileUrl = fileUrlFromBody(request.body);
        if (!fileUrl) {
          return reply.status(400).send({
            status: 'error',
            error_code: 'NO_FILE_UPLOADED',
            message: 'Provide a public PDF URL in JSON field "file".'
          });
        }

        const downloaded = await downloadPdfFromUrl(fileUrl);
        buffer = downloaded.buffer;
        filename = downloaded.filename;
        if (!filename.toLowerCase().endsWith('.pdf') && buffer.subarray(0, 5).toString('utf8') !== '%PDF-') {
          return reply.status(400).send({
            status: 'error',
            error_code: 'INVALID_FILE_TYPE',
            message: 'Only PDF files (application/pdf) are supported.'
          });
        }
      }

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
      if (error && typeof error === 'object' && 'statusCode' in error && Number(error.statusCode) === 413) {
        return reply.status(413).send({
          status: 'error',
          error_code: 'FILE_TOO_LARGE',
          message: error instanceof Error ? error.message : 'The PDF is too large.'
        });
      }

      if (error && typeof error === 'object' && 'error_code' in error && error.error_code === 'INVALID_PDF') {
        return reply.status(400).send({
          status: 'error',
          error_code: 'INVALID_PDF',
          message: error instanceof Error
            ? `Could not read this PDF (${error.message}). Use a text-layer PDF, not a scanned image.`
            : 'Could not read this PDF. Use a text-layer PDF, not a scanned image.'
        });
      }

      if (error && typeof error === 'object' && 'statusCode' in error && Number(error.statusCode) === 400) {
        return reply.status(400).send({
          status: 'error',
          error_code: 'DOWNLOAD_FAILED',
          message: error instanceof Error ? error.message : 'Could not download the PDF URL.'
        });
      }

      if (isNotMultipartError(error)) {
        return reply.status(400).send({
          status: 'error',
          error_code: 'NOT_MULTIPART',
          message: 'Send a PDF as multipart/form-data field "file", or JSON {"file":"https://example.com/file.pdf"}.'
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
