# TableJSON — PDF Table Extractor API

Extract tables from text-layer PDFs into clean JSON. Built for RapidAPI, Zapier, and direct HTTP use.

**Live playground:** [https://tablejson.com](https://tablejson.com)

This API reads the PDF text layer. It does **not** OCR scanned or image-only PDFs.

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | No | Interactive playground |
| GET | `/v1/health` | No | Health check |
| GET | `/openapi.json` | No | OpenAPI 3 spec (RapidAPI import) |
| POST | `/v1/extract-tables` | Yes | Upload a PDF, get tables as JSON |

Opening `/v1/extract-tables` in a browser redirects to the playground. Clients must **POST** a file.

## Authentication

Direct / Zapier calls need the production API key:

```http
X-API-Key: YOUR_API_KEY
```

or

```http
Authorization: Bearer YOUR_API_KEY
```

The playground on tablejson.com works without a key (same-origin, rate limited).

When the API is listed on RapidAPI, set `RAPIDAPI_PROXY_SECRET` on Railway. RapidAPI traffic is then accepted via `X-RapidAPI-Proxy-Secret`.

Rate limit: **20 extract requests per minute** per IP.

## Quick start

```bash
curl -X POST "https://tablejson.com/v1/extract-tables" \
  -H "X-API-Key: YOUR_API_KEY" \
  -F "file=@invoice.pdf"
```

Example success shape:

```json
{
  "status": "success",
  "filename": "invoice.pdf",
  "total_pages": 3,
  "tables_found": 1,
  "metadata": {
    "execution_time_ms": 42,
    "extraction_mode": "text"
  },
  "tables": [
    {
      "table_id": 1,
      "page_number": 1,
      "page_end": 3,
      "headers": ["date", "amount"],
      "total_rows": 12,
      "rows": []
    }
  ]
}
```

## Local development

```bash
cp .env.example .env
npm install
npm run dev
```

Server: `http://localhost:3000`

```bash
npm run build
npm start
npm run test:sample
```

Required env:

```
PORT=3000
NODE_ENV=development
PUBLIC_BASE_URL=https://tablejson.com
API_KEY=change-me
# RAPIDAPI_PROXY_SECRET=
```

## RapidAPI listing

1. Go to [rapidapi.com/studio](https://rapidapi.com/studio) → **Add API Project**
2. Import OpenAPI from [https://tablejson.com/openapi.json](https://tablejson.com/openapi.json)
3. Name: **TableJSON — PDF Table to JSON**
4. Category: **Data** (or Documents)
5. Base URL / target: `https://tablejson.com`
6. Security: RapidAPI gateway headers. On Railway, set `RAPIDAPI_PROXY_SECRET` to the secret RapidAPI shows you.
7. Suggested plans: Basic (free, low quota), Pro `$19/mo` (10,000 calls)

Short Hub description:

> Upload a PDF and get structured tables as JSON. Supports large files (up to 500MB). Text-layer PDFs only — not scanned documents.

## Zapier

Use **Webhooks by Zapier** until the Zapier app is published:

- URL: `https://tablejson.com/v1/extract-tables`
- Method: POST
- Header: `X-API-Key`
- Body: multipart field `file`

## Deploy

Hosted on Railway. After code changes:

```bash
npm run build
railway up -s pdf-table-extractor-api -y --ci
```

Custom domain: `tablejson.com` (Cloudflare DNS → Railway). SSL is automatic.

## License

MIT
