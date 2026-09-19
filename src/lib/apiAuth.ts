import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

function safeEqual(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left);
  const rightBuf = Buffer.from(right);
  if (leftBuf.length !== rightBuf.length) {
    return false;
  }
  return timingSafeEqual(leftBuf, rightBuf);
}

export function isAuthConfigured(): boolean {
  return Boolean(process.env.API_KEY || process.env.RAPIDAPI_PROXY_SECRET);
}

export function isPlaygroundBrowserRequest(request: FastifyRequest): boolean {
  const host = request.headers.host;
  if (!host) {
    return false;
  }

  for (const value of [request.headers.origin, request.headers.referer]) {
    if (typeof value !== 'string' || value.length === 0) {
      continue;
    }
    try {
      if (new URL(value).host === host) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

export function hasValidApiCredentials(request: FastifyRequest): boolean {
  const rapidSecret = process.env.RAPIDAPI_PROXY_SECRET;
  const providedRapidSecret = request.headers['x-rapidapi-proxy-secret'];
  if (rapidSecret && typeof providedRapidSecret === 'string' && safeEqual(providedRapidSecret, rapidSecret)) {
    return true;
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return false;
  }

  const headerKey = request.headers['x-api-key'];
  const authorization = request.headers.authorization;
  const bearer = typeof authorization === 'string' && authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : undefined;
  const providedKey = typeof headerKey === 'string' ? headerKey : bearer;

  return Boolean(providedKey && safeEqual(providedKey, apiKey));
}

export async function requireExtractAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!isAuthConfigured()) {
    return;
  }
  if (isPlaygroundBrowserRequest(request)) {
    return;
  }
  if (hasValidApiCredentials(request)) {
    return;
  }

  return reply.status(401).send({
    status: 'error',
    error_code: 'UNAUTHORIZED',
    message: 'Missing or invalid API key. Send X-API-Key, Authorization: Bearer <key>, or a valid RapidAPI proxy secret.'
  });
}
