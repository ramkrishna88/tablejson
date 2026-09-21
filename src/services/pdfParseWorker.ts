import { parentPort, workerData } from 'node:worker_threads';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse') as (
  data: Uint8Array,
  options: { pagerender: (pageData: any) => Promise<string> }
) => Promise<{ text?: string; numpages?: number; info?: Record<string, unknown> }>;

const PAGE_MARKER_PREFIX = '__PAGE_BREAK__';

async function renderPageWithMarker(pageData: {
  pageIndex?: number;
  getTextContent: (options: { normalizeWhitespace: boolean; disableCombineTextItems: boolean }) => Promise<{
    items: Array<{ str: string; transform: number[] }>;
  }>;
}): Promise<string> {
  const pageNumber = (pageData.pageIndex ?? 0) + 1;
  const textContent = await pageData.getTextContent({
    normalizeWhitespace: false,
    disableCombineTextItems: false
  });

  let lastY: number | undefined;
  let text = '';
  for (const item of textContent.items) {
    if (lastY === item.transform[5] || lastY === undefined) {
      text += item.str;
    } else {
      text += `\n${item.str}`;
    }
    lastY = item.transform[5];
  }

  return `${PAGE_MARKER_PREFIX}${pageNumber}__\n${text}`;
}

const pdfBytes = Uint8Array.from(
  Buffer.isBuffer(workerData)
    ? workerData
    : Buffer.from((workerData as { bytes?: Uint8Array }).bytes ?? workerData)
);

try {
  const pdfData = await pdfParse(pdfBytes, {
    pagerender: renderPageWithMarker
  });

  parentPort?.postMessage({
    text: pdfData.text || '',
    numpages: pdfData.numpages || 1,
    info: pdfData.info || {}
  });
} catch (error) {
  const message = error instanceof Error ? error.message : 'PDF parser failed.';
  throw new Error(message);
}
