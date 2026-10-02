import ExcelJS from 'exceljs';
import type { ExtractedTable, PdfModel, TableRow } from './pdfExtractor.js';

export type InvoiceStatus = 'PASS' | 'FAIL';

export type LineItem = {
  description: string;
  qty: string;
  unitPrice: string;
  amount: string;
  qtyValue: number | null;
  unitPriceMinor: number | null;
  amountMinor: number | null;
  lineCheck: 'PASS' | 'FAIL';
};

export type InvoiceClose = {
  vendor: string;
  invoiceNumber: string;
  date: string;
  currency: string | null;
  exponent: number;
  mapped: boolean;
  lines: LineItem[];
  shippingMinor: number;
  otherMinor: number;
  discountMinor: number;
  signedDiscountMinor: number;
  taxMinor: number;
  subtotalMinor: number | null;
  statedTotalMinor: number | null;
  lineSumMinor: number;
  expectedTotalMinor: number;
  remainderMinor: number;
  totalsPass: boolean;
  status: InvoiceStatus;
  statusCopy: string;
  page1Lines: string[];
  tables: ExtractedTable[];
};

const DESCRIPTION_ALIASES = ['description', 'item', 'particulars'];
const QTY_ALIASES = ['qty', 'quantity'];
const UNIT_PRICE_ALIASES = ['unitprice', 'rate', 'price'];
const AMOUNT_ALIASES = ['amount', 'linetotal', 'net', 'value'];

const ADDEND_LABELS = {
  shipping: ['shipping', 'freight', 'delivery'],
  discount: ['discount', 'lessdiscount'],
  tax: ['tax', 'vat', 'gst', 'salestax'],
  subtotal: ['subtotal'],
  stated: ['amountdue', 'balancedue', 'grandtotal', 'total']
} as const;

const STATED_PREFERENCE = ['amountdue', 'balancedue', 'grandtotal', 'total'] as const;

const CURRENCY_TOKENS: Array<{ token: string; code: string }> = [
  { token: 'USD', code: 'USD' },
  { token: 'INR', code: 'INR' },
  { token: 'GBP', code: 'GBP' },
  { token: 'EUR', code: 'EUR' },
  { token: 'JPY', code: 'JPY' },
  { token: 'KRW', code: 'KRW' },
  { token: '£', code: 'GBP' },
  { token: '₹', code: 'INR' },
  { token: '¥', code: 'JPY' },
  { token: '₩', code: 'KRW' },
  { token: '$', code: 'USD' }
];

const FAIL_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFC7CE' }
};
const FAIL_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FF9C0006' }, bold: true };

export function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/#/g, 'no')
    .replace(/[^a-z0-9_\s]/g, '')
    .replace(/[_\s]+/g, '');
}

function allAddendKeys(): string[] {
  return [
    ...ADDEND_LABELS.shipping,
    ...ADDEND_LABELS.discount,
    ...ADDEND_LABELS.tax,
    ...ADDEND_LABELS.subtotal,
    ...ADDEND_LABELS.stated
  ];
}

function isAddendLabel(value: string): boolean {
  return allAddendKeys().includes(normalizeKey(value));
}

function bindHeader(headers: string[], aliases: string[]): string | undefined {
  for (const header of headers) {
    if (aliases.includes(normalizeKey(header))) {
      return header;
    }
  }
  return undefined;
}

function largestTable(tables: ExtractedTable[]): ExtractedTable | undefined {
  if (tables.length === 0) {
    return undefined;
  }
  return [...tables].sort((a, b) => {
    if (b.total_rows !== a.total_rows) {
      return b.total_rows - a.total_rows;
    }
    return a.table_id - b.table_id;
  })[0];
}

function cellText(row: TableRow, header?: string): string {
  if (!header) {
    return '';
  }
  return String(row.data[header] ?? '').trim();
}

function lastNumericCell(row: TableRow): string {
  for (let i = row.raw_cells.length - 1; i >= 0; i -= 1) {
    const cell = String(row.raw_cells[i] || '').trim();
    if (cell && looksNumeric(cell)) {
      return cell;
    }
  }
  const values = Object.values(row.data).map((value) => String(value || '').trim()).filter(Boolean);
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (looksNumeric(values[i])) {
      return values[i];
    }
  }
  return values[values.length - 1] || '';
}

function looksNumeric(value: string): boolean {
  return /[\d]/.test(value) && /[\d.,()]+/.test(value.replace(/[A-Za-z$£₹¥₩\s]/g, ''));
}

export function detectCurrency(texts: string[]): string | null {
  for (const text of texts) {
    const upper = text.toUpperCase();
    for (const { token, code } of CURRENCY_TOKENS) {
      if (token.length === 1) {
        if (text.includes(token)) {
          return code;
        }
      } else if (new RegExp(`\\b${token}\\b`, 'i').test(upper) || upper.includes(token)) {
        return code;
      }
    }
  }
  return null;
}

export function currencyExponent(code: string | null): number {
  return code === 'JPY' || code === 'KRW' ? 0 : 2;
}

export function parseMoneyToMinor(raw: string, currency: string | null): number | null {
  let text = raw.trim();
  if (!text) {
    return null;
  }

  const negative = /^\(.*\)$/.test(text);
  text = text.replace(/^\((.*)\)$/, '$1');

  for (const { token } of CURRENCY_TOKENS) {
    text = token.length === 1 ? text.split(token).join('') : text.replace(new RegExp(token, 'ig'), '');
  }
  text = text.replace(/[^\d.,\-]/g, '').trim();
  if (!text || text === '-' || text === '.' || text === ',') {
    return null;
  }

  const hasDot = text.includes('.');
  const hasComma = text.includes(',');
  if (hasDot && hasComma) {
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    text = text.replace(/,/g, '');
  }

  if (currency === 'INR') {
    text = text.replace(/,/g, '');
  }

  const value = Number(text);
  if (!Number.isFinite(value)) {
    return null;
  }

  const exponent = currencyExponent(currency);
  const minor = exponent === 0 ? Math.round(value) : Math.round(value * 10 ** exponent);
  return negative ? -Math.abs(minor) : minor;
}

export function parseQty(raw: string): number | null {
  const minor = parseMoneyToMinor(raw, 'USD');
  if (minor == null) {
    return null;
  }
  return minor / 100;
}

function formatMinor(minor: number | null, exponent: number): string {
  if (minor == null) {
    return '';
  }
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  if (exponent === 0) {
    return `${sign}${abs}`;
  }
  const factor = 10 ** exponent;
  const whole = Math.floor(abs / factor);
  const frac = String(abs % factor).padStart(exponent, '0');
  return `${sign}${whole}.${frac}`;
}

function valueNearLabel(lines: string[], labels: string[], skipIf?: (line: string) => boolean): string {
  const normalizedLabels = labels.map(normalizeKey);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (skipIf?.(line)) {
      continue;
    }
    const normalizedLine = normalizeKey(line);
    const matched = labels.find((label) => {
      const key = normalizeKey(label);
      if (key === 'from') {
        return /^(from)\b/i.test(line.trim());
      }
      return normalizeKey(line).includes(key);
    });
    if (!matched) {
      continue;
    }
    const after = stripLabel(line, labels);
    if (after) {
      return after;
    }
    const next = lines[i + 1];
    if (next && !skipIf?.(next) && !normalizedLabels.some((label) => normalizeKey(next).includes(label))) {
      return next.trim();
    }
  }
  return '';
}

function stripLabel(line: string, labels: string[]): string {
  let remaining = line;
  for (const label of [...labels].sort((a, b) => b.length - a.length)) {
    remaining = remaining.replace(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '');
  }
  return remaining.replace(/^[\s:#\-–—]+/, '').trim();
}

function parseInvoiceDate(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  const iso = trimmed.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) {
    return iso[0];
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }
  return trimmed;
}

function classifyAddend(description: string): keyof typeof ADDEND_LABELS | null {
  const key = normalizeKey(description);
  if ((ADDEND_LABELS.shipping as readonly string[]).includes(key)) return 'shipping';
  if ((ADDEND_LABELS.discount as readonly string[]).includes(key)) return 'discount';
  if ((ADDEND_LABELS.tax as readonly string[]).includes(key)) return 'tax';
  if ((ADDEND_LABELS.subtotal as readonly string[]).includes(key)) return 'subtotal';
  if ((ADDEND_LABELS.stated as readonly string[]).includes(key)) return 'stated';
  return null;
}

function statedRank(description: string): number {
  const key = normalizeKey(description);
  const index = STATED_PREFERENCE.indexOf(key as typeof STATED_PREFERENCE[number]);
  return index === -1 ? 99 : index;
}

function collectAddendRows(tables: ExtractedTable[], lineTableId: number): Array<{ kind: keyof typeof ADDEND_LABELS; label: string; raw: string }> {
  const found: Array<{ kind: keyof typeof ADDEND_LABELS; label: string; raw: string }> = [];
  const ordered = [
    ...tables.filter((table) => table.table_id === lineTableId),
    ...tables.filter((table) => table.table_id !== lineTableId)
  ];

  for (const table of ordered) {
    const descriptionHeader = bindHeader(table.headers, DESCRIPTION_ALIASES) || table.headers[0];
    for (const row of table.rows) {
      const description = cellText(row, descriptionHeader) || String(row.raw_cells[0] || '');
      const kind = classifyAddend(description);
      if (!kind) {
        continue;
      }
      found.push({ kind, label: description, raw: lastNumericCell(row) });
    }
  }
  return found;
}

export function closeInvoice(model: PdfModel): InvoiceClose {
  const page1Lines = model.page1Lines;
  const vendor = valueNearLabel(page1Lines, ['billed by', 'supplier', 'vendor', 'from']);
  const invoiceNumber = valueNearLabel(page1Lines, ['invoice no', 'invoice #', 'inv #', 'invoiceno', 'invoice number']);
  const date = parseInvoiceDate(valueNearLabel(
    page1Lines,
    ['invoice date'],
    (line) => /due\s*date/i.test(line) || /\bterms\b/i.test(line)
  ));

  const empty: InvoiceClose = {
    vendor,
    invoiceNumber,
    date,
    currency: null,
    exponent: 2,
    mapped: false,
    lines: [],
    shippingMinor: 0,
    otherMinor: 0,
    discountMinor: 0,
    signedDiscountMinor: 0,
    taxMinor: 0,
    subtotalMinor: null,
    statedTotalMinor: null,
    lineSumMinor: 0,
    expectedTotalMinor: 0,
    remainderMinor: 0,
    totalsPass: false,
    status: 'FAIL',
    statusCopy: 'FAIL: no text layer',
    page1Lines,
    tables: model.tables
  };

  if (!model.rawText.trim()) {
    return empty;
  }

  const table = largestTable(model.tables);
  if (!table) {
    return { ...empty, statusCopy: 'FAIL: no line table' };
  }

  const descriptionHeader = bindHeader(table.headers, DESCRIPTION_ALIASES);
  const qtyHeader = bindHeader(table.headers, QTY_ALIASES);
  const unitHeader = bindHeader(table.headers, UNIT_PRICE_ALIASES);
  const amountHeader = bindHeader(table.headers, AMOUNT_ALIASES);
  const mapped = Boolean(descriptionHeader && qtyHeader && unitHeader && amountHeader);

  const dropped: TableRow[] = [];
  const kept: TableRow[] = [];
  for (const row of table.rows) {
    const description = cellText(row, descriptionHeader) || String(row.raw_cells[0] || '');
    if (isAddendLabel(description)) {
      dropped.push(row);
    } else {
      kept.push(row);
    }
  }

  if (!mapped || kept.length === 0) {
    return { ...empty, statusCopy: 'FAIL: no line table' };
  }

  const addends = [
    ...dropped.map((row) => {
      const description = cellText(row, descriptionHeader) || String(row.raw_cells[0] || '');
      return { kind: classifyAddend(description) || 'stated' as const, label: description, raw: lastNumericCell(row) };
    }),
    ...collectAddendRows(model.tables, table.table_id).filter((row) => {
      return !dropped.some((droppedRow) => lastNumericCell(droppedRow) === row.raw && normalizeKey(cellText(droppedRow, descriptionHeader) || '') === normalizeKey(row.label));
    })
  ];

  const currencySources = [
    ...addends.map((row) => row.raw),
    ...addends.filter((row) => row.kind === 'stated').map((row) => `${row.label} ${row.raw}`),
    ...page1Lines
  ];
  const currency = detectCurrency(currencySources);
  const exponent = currencyExponent(currency);

  let shippingMinor = 0;
  let otherMinor = 0;
  let discountMinor = 0;
  let taxMinor = 0;
  let subtotalMinor: number | null = null;
  let stated: { rank: number; minor: number } | null = null;

  const claimed = new Set<string>();
  for (const addend of addends) {
    const key = `${addend.kind}:${normalizeKey(addend.label)}:${addend.raw}`;
    if (claimed.has(key)) {
      continue;
    }
    claimed.add(key);
    const minor = parseMoneyToMinor(addend.raw, currency);
    if (minor == null) {
      continue;
    }
    if (addend.kind === 'shipping') {
      shippingMinor += minor;
    } else if (addend.kind === 'discount') {
      discountMinor += minor;
    } else if (addend.kind === 'tax') {
      taxMinor += minor;
    } else if (addend.kind === 'subtotal') {
      subtotalMinor = (subtotalMinor ?? 0) + minor;
    } else if (addend.kind === 'stated') {
      const rank = statedRank(addend.label);
      if (!stated || rank < stated.rank) {
        stated = { rank, minor };
      }
    }
  }

  for (const row of dropped) {
    const description = cellText(row, descriptionHeader) || String(row.raw_cells[0] || '');
    if (classifyAddend(description)) {
      continue;
    }
    const minor = parseMoneyToMinor(lastNumericCell(row), currency);
    if (minor != null) {
      otherMinor += minor;
    }
  }

  const signedDiscountMinor = -Math.abs(discountMinor);
  const lines: LineItem[] = kept.map((row) => {
    const description = cellText(row, descriptionHeader);
    const qtyRaw = cellText(row, qtyHeader);
    const unitRaw = cellText(row, unitHeader);
    const amountRaw = cellText(row, amountHeader);
    const qtyValue = parseQty(qtyRaw);
    const unitPriceMinor = parseMoneyToMinor(unitRaw, currency);
    const amountMinor = parseMoneyToMinor(amountRaw, currency);
    const expectedAmount = qtyValue != null && unitPriceMinor != null
      ? Math.round(qtyValue * unitPriceMinor)
      : null;
    const lineCheck = expectedAmount != null && amountMinor != null && Math.abs(expectedAmount - amountMinor) <= 1
      ? 'PASS'
      : 'FAIL';
    return {
      description,
      qty: qtyRaw,
      unitPrice: unitRaw,
      amount: amountRaw,
      qtyValue,
      unitPriceMinor,
      amountMinor,
      lineCheck
    };
  });

  const lineSumMinor = lines.reduce((sum, line) => sum + (line.amountMinor ?? 0), 0);
  const statedTotalMinor = stated?.minor ?? null;
  const expectedTotalMinor = lineSumMinor + shippingMinor + otherMinor + signedDiscountMinor + taxMinor;
  const remainderMinor = statedTotalMinor == null ? expectedTotalMinor : expectedTotalMinor - statedTotalMinor;
  const totalsPass = currency != null && statedTotalMinor != null && Math.abs(remainderMinor) <= 1;

  let statusCopy = 'PASS';
  if (!currency) {
    statusCopy = 'FAIL: currency unknown';
  } else if (!invoiceNumber) {
    statusCopy = 'FAIL: invoice_number missing';
  } else if (!totalsPass) {
    statusCopy = `FAIL: lines+shipping+other+discount+tax = ${formatMinor(expectedTotalMinor, exponent)}; stated total = ${formatMinor(statedTotalMinor, exponent)}; remainder = ${formatMinor(remainderMinor, exponent)}`;
  }

  const status: InvoiceStatus = invoiceNumber && totalsPass ? 'PASS' : 'FAIL';

  return {
    vendor,
    invoiceNumber,
    date,
    currency,
    exponent,
    mapped: true,
    lines,
    shippingMinor,
    otherMinor,
    discountMinor,
    signedDiscountMinor,
    taxMinor,
    subtotalMinor,
    statedTotalMinor,
    lineSumMinor,
    expectedTotalMinor,
    remainderMinor,
    totalsPass,
    status,
    statusCopy,
    page1Lines,
    tables: model.tables
  };
}

export function failClose(message: string, page1Lines: string[] = [], tables: ExtractedTable[] = []): InvoiceClose {
  return {
    vendor: '',
    invoiceNumber: '',
    date: '',
    currency: null,
    exponent: 2,
    mapped: false,
    lines: [],
    shippingMinor: 0,
    otherMinor: 0,
    discountMinor: 0,
    signedDiscountMinor: 0,
    taxMinor: 0,
    subtotalMinor: null,
    statedTotalMinor: null,
    lineSumMinor: 0,
    expectedTotalMinor: 0,
    remainderMinor: 0,
    totalsPass: false,
    status: 'FAIL',
    statusCopy: message,
    page1Lines,
    tables
  };
}

function paintFail(cell: ExcelJS.Cell): void {
  cell.fill = FAIL_FILL;
  cell.font = FAIL_FONT;
}

export async function workbookFromClose(close: InvoiceClose): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TableJSON';
  const invoice = workbook.addWorksheet('Invoice');
  const raw = workbook.addWorksheet('Raw extract');
  const money = (minor: number | null) => formatMinor(minor, close.exponent);

  invoice.getCell('A1').value = 'vendor';
  invoice.getCell('B1').value = close.vendor;
  invoice.getCell('A2').value = 'invoice_number';
  invoice.getCell('B2').value = close.invoiceNumber;
  invoice.getCell('A3').value = 'date';
  invoice.getCell('B3').value = close.date;
  invoice.getCell('A4').value = 'currency';
  invoice.getCell('B4').value = close.currency ?? '';
  invoice.getCell('A5').value = 'stated_total';
  invoice.getCell('B5').value = money(close.statedTotalMinor);
  invoice.getCell('A6').value = 'checksum';
  invoice.getCell('B6').value = close.statusCopy;

  if (close.status === 'FAIL') {
    paintFail(invoice.getCell('B6'));
  }

  invoice.getRow(7).values = ['description', 'qty', 'unit_price', 'amount', 'line_check'];
  invoice.getRow(7).font = { bold: true };
  close.lines.forEach((line, index) => {
    const row = invoice.getRow(8 + index);
    row.values = [line.description, line.qty, line.unitPrice, line.amount, line.lineCheck];
    if (line.lineCheck === 'FAIL') {
      paintFail(row.getCell(5));
    }
  });

  invoice.views = [{ state: 'frozen', xSplit: 0, ySplit: 7 }];

  let footer = 8 + close.lines.length + 1;
  const writeFooter = (label: string, value: string, fail = false) => {
    invoice.getCell(`A${footer}`).value = label;
    invoice.getCell(`B${footer}`).value = value;
    if (fail) {
      paintFail(invoice.getCell(`B${footer}`));
    }
    footer += 1;
  };

  writeFooter('shipping', money(close.shippingMinor));
  writeFooter('other', money(close.otherMinor));
  writeFooter('discount', money(close.signedDiscountMinor));
  writeFooter('tax', money(close.taxMinor));
  if (close.subtotalMinor != null) {
    writeFooter('subtotal', money(close.subtotalMinor));
    writeFooter('subtotal_delta', money(close.lineSumMinor - close.subtotalMinor));
  }
  writeFooter('stated_total', money(close.statedTotalMinor), close.status === 'FAIL' && close.statedTotalMinor != null);
  writeFooter('expected_total', money(close.expectedTotalMinor), close.status === 'FAIL');
  writeFooter('remainder', money(close.remainderMinor), close.status === 'FAIL');
  writeFooter('checksum', close.status === 'PASS' ? 'PASS' : close.statusCopy, close.status === 'FAIL');

  invoice.columns = [{ width: 22 }, { width: 28 }, { width: 16 }, { width: 16 }, { width: 14 }];

  raw.getCell('A1').value = 'page_1_lines';
  raw.getCell('A1').font = { bold: true };
  close.page1Lines.forEach((line, index) => {
    raw.getCell(`A${index + 2}`).value = line;
  });

  let tableStart = close.page1Lines.length + 4;
  close.tables.forEach((table) => {
    raw.getCell(`A${tableStart}`).value = `table_${table.table_id}`;
    raw.getCell(`A${tableStart}`).font = { bold: true };
    tableStart += 1;
    table.headers.forEach((header, col) => {
      raw.getCell(tableStart, col + 1).value = header;
      raw.getCell(tableStart, col + 1).font = { bold: true };
    });
    tableStart += 1;
    table.rows.forEach((row) => {
      table.headers.forEach((header, col) => {
        raw.getCell(tableStart, col + 1).value = cellText(row, header);
      });
      tableStart += 1;
    });
    tableStart += 2;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function xlsxBasename(filename: string): string {
  const base = filename.replace(/\\/g, '/').split('/').pop() || 'invoice.pdf';
  return base.replace(/\.pdf$/i, '') || 'invoice';
}
