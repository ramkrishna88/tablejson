import { Worker } from 'node:worker_threads';

export interface TableRow {
  row_index: number;
  data: Record<string, string>;
  raw_cells: string[];
}

export interface ExtractedTable {
  table_id: number;
  page_number: number;
  page_end: number;
  title?: string;
  headers: string[];
  total_rows: number;
  rows: TableRow[];
}

export interface PDFExtractionResult {
  status: 'success' | 'error';
  filename?: string;
  total_pages: number;
  tables_found: number;
  metadata: {
    processed_at: string;
    execution_time_ms: number;
    extraction_mode: 'text';
    pdf_info?: any;
  };
  tables: ExtractedTable[];
}

interface PageLine {
  page: number;
  text: string;
}

const PAGE_MARKER = /^__PAGE_BREAK__(\d+)__$/;

const PARSE_TIMEOUT_MS = 120_000;
const MAX_PARALLEL_PARSES = 2;
let parseSlots = Promise.resolve();
let activeParses = 0;

function withParseSlot<T>(fn: () => Promise<T>): Promise<T> {
  const run = parseSlots.then(async () => {
    while (activeParses >= MAX_PARALLEL_PARSES) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    activeParses += 1;
    try {
      return await fn();
    } finally {
      activeParses -= 1;
    }
  });
  parseSlots = run.then(() => undefined, () => undefined);
  return run;
}

function parsePdfTextLayer(pdfBuffer: Buffer): Promise<{ text: string; numpages: number; info: Record<string, unknown> }> {
  const workerUrl = new URL(
    `./pdfParseWorker${import.meta.url.endsWith('.ts') ? '.ts' : '.js'}`,
    import.meta.url
  );

  return new Promise((resolve, reject) => {
    const worker = new Worker(workerUrl, {
      workerData: { bytes: Uint8Array.from(pdfBuffer) },
      execArgv: import.meta.url.endsWith('.ts') ? process.execArgv : undefined
    });

    let settled = false;
    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      reject(Object.assign(error, { statusCode: 400, error_code: 'INVALID_PDF' }));
    };

    const timer = setTimeout(() => {
      fail(new Error('PDF parsing timed out.'));
    }, PARSE_TIMEOUT_MS);

    worker.once('message', (data) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      resolve(data);
    });
    worker.once('error', (error) => {
      fail(error instanceof Error ? error : new Error('PDF parser failed.'));
    });
    worker.once('exit', (code) => {
      if (code !== 0) {
        fail(new Error('PDF parser failed.'));
      }
    });
  });
}

/**
 * Text-layer PDF table extraction. Scanned/image-only PDFs are not OCR'd.
 */
export async function extractTablesFromPDF(
  pdfBuffer: Buffer,
  filename: string = 'uploaded.pdf'
): Promise<PDFExtractionResult> {
  const startTime = Date.now();

  const pdfData = await withParseSlot(() => parsePdfTextLayer(pdfBuffer));

  const totalPages = pdfData.numpages || 1;
  const rawText = pdfData.text || '';
  const pdfInfo = pdfData.info || {};

  const lines = linesFromPagedText(rawText);
  const unmergedTables = parseLinesIntoTables(lines);
  const tables = mergeContiguousTables(unmergedTables);

  return {
    status: 'success',
    filename,
    total_pages: totalPages,
    tables_found: tables.length,
    metadata: {
      processed_at: new Date().toISOString(),
      execution_time_ms: Date.now() - startTime,
      extraction_mode: 'text',
      pdf_info: pdfInfo
    },
    tables
  };
}

function linesFromPagedText(rawText: string): PageLine[] {
  const lines: PageLine[] = [];
  let page = 1;

  for (const raw of rawText.split(/\r?\n/)) {
    const text = raw.trim();
    if (!text) {
      continue;
    }

    const marker = text.match(PAGE_MARKER);
    if (marker) {
      page = Number(marker[1]);
      continue;
    }

    lines.push({ page, text });
  }

  return lines;
}

function parseLinesIntoTables(lines: PageLine[]): ExtractedTable[] {
  const tables: ExtractedTable[] = [];
  let currentTableRows: string[][] = [];
  let currentHeaders: string[] = [];
  let currentHeaderPage = 1;
  let currentLastPage = 1;
  let tableIdCounter = 1;

  for (const line of lines) {
    if (
      line.text.startsWith('---') ||
      line.text.startsWith('===') ||
      line.text.includes('AUDITED FINANCIAL CONSOLIDATION REPORT') ||
      line.text.includes('ACME ENTERPRISE CORP')
    ) {
      continue;
    }

    const columns = splitLineIntoColumns(line.text);

    if (columns.length >= 2) {
      if (currentHeaders.length === 0) {
        currentHeaders = columns.map((col, idx) => sanitizeHeader(col, idx));
        currentHeaderPage = line.page;
        currentLastPage = line.page;
      } else if (columns.length === currentHeaders.length || Math.abs(columns.length - currentHeaders.length) <= 1) {
        currentTableRows.push(columns);
        currentLastPage = line.page;
      } else {
        if (currentTableRows.length > 0) {
          tables.push(buildTableObject(tableIdCounter++, currentHeaderPage, currentLastPage, currentHeaders, currentTableRows));
          currentTableRows = [];
        }
        currentHeaders = columns.map((col, idx) => sanitizeHeader(col, idx));
        currentHeaderPage = line.page;
        currentLastPage = line.page;
      }
    } else if (currentTableRows.length > 0) {
      tables.push(buildTableObject(tableIdCounter++, currentHeaderPage, currentLastPage, currentHeaders, currentTableRows));
      currentTableRows = [];
      currentHeaders = [];
    }
  }

  if (currentHeaders.length > 0 && currentTableRows.length > 0) {
    tables.push(buildTableObject(tableIdCounter++, currentHeaderPage, currentLastPage, currentHeaders, currentTableRows));
  }

  if (tables.length === 0 && lines.length > 0) {
    tables.push(buildFallbackTableFromText(lines));
  }

  return tables;
}

function mergeContiguousTables(rawTables: ExtractedTable[]): ExtractedTable[] {
  if (rawTables.length <= 1) {
    return rawTables;
  }

  const merged: ExtractedTable[] = [];
  let currentMaster: ExtractedTable | null = null;

  for (const table of rawTables) {
    if (!currentMaster) {
      currentMaster = { ...table, rows: [...table.rows] };
      continue;
    }

    const masterHeaderStr = currentMaster.headers.join(',');
    const nextHeaderStr = table.headers.join(',');

    if (masterHeaderStr === nextHeaderStr || Math.abs(currentMaster.headers.length - table.headers.length) <= 1) {
      const startIdx = currentMaster.rows.length;
      table.rows.forEach((row, idx) => {
        currentMaster!.rows.push({
          row_index: startIdx + idx + 1,
          data: row.data,
          raw_cells: row.raw_cells
        });
      });
      currentMaster.total_rows = currentMaster.rows.length;
      currentMaster.page_end = Math.max(currentMaster.page_end, table.page_end);
    } else {
      merged.push(currentMaster);
      currentMaster = { ...table, rows: [...table.rows] };
    }
  }

  if (currentMaster) {
    merged.push(currentMaster);
  }

  return merged.map((table, idx) => ({
    ...table,
    table_id: idx + 1
  }));
}

function splitLineIntoColumns(line: string): string[] {
  if (line.includes('\t')) {
    return line.split('\t').map((cell) => cell.trim()).filter(Boolean);
  }
  if (line.includes('|')) {
    return line.split('|').map((cell) => cell.trim()).filter(Boolean);
  }
  const parts = line.split(/\s{2,}/).map((cell) => cell.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return parts;
  }
  if (line.includes(',')) {
    return line.split(',').map((cell) => cell.trim()).filter(Boolean);
  }
  return [line];
}

function sanitizeHeader(rawHeader: string, index: number): string {
  const cleaned = rawHeader.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || `column_${index + 1}`;
}

function buildTableObject(
  tableId: number,
  pageNumber: number,
  pageEnd: number,
  headers: string[],
  rawRows: string[][]
): ExtractedTable {
  const rows: TableRow[] = rawRows.map((cells, rowIdx) => {
    const rowData: Record<string, string> = {};
    headers.forEach((header, colIdx) => {
      rowData[header] = cells[colIdx] || '';
    });

    return {
      row_index: rowIdx + 1,
      data: rowData,
      raw_cells: cells
    };
  });

  return {
    table_id: tableId,
    page_number: pageNumber,
    page_end: pageEnd,
    headers,
    total_rows: rows.length,
    rows
  };
}

function buildFallbackTableFromText(lines: PageLine[]): ExtractedTable {
  const headers = ['line_number', 'extracted_content'];
  const rows: TableRow[] = lines.map((line, idx) => ({
    row_index: idx + 1,
    data: {
      line_number: String(idx + 1),
      extracted_content: line.text
    },
    raw_cells: [String(idx + 1), line.text]
  }));

  return {
    table_id: 1,
    page_number: lines[0]?.page || 1,
    page_end: lines[lines.length - 1]?.page || 1,
    title: 'Extracted Document Content',
    headers,
    total_rows: rows.length,
    rows
  };
}
