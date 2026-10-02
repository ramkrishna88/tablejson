import test from 'node:test';
import assert from 'node:assert/strict';
import {
  closeInvoice,
  detectCurrency,
  normalizeKey,
  parseMoneyToMinor,
  workbookFromClose
} from './invoiceWorkbook.js';
import type { ExtractedTable, PdfModel } from './pdfExtractor.js';

function table(headers: string[], rows: string[][], tableId = 1): ExtractedTable {
  return {
    table_id: tableId,
    page_number: 1,
    page_end: 1,
    headers,
    total_rows: rows.length,
    rows: rows.map((raw_cells, index) => ({
      row_index: index + 1,
      data: Object.fromEntries(headers.map((header, col) => [header, raw_cells[col] || ''])),
      raw_cells
    }))
  };
}

function model(partial: Partial<PdfModel> & { tables: ExtractedTable[]; page1Lines: string[] }): PdfModel {
  return {
    filename: 'invoice.pdf',
    totalPages: 1,
    rawText: partial.rawText ?? 'invoice',
    page1Lines: partial.page1Lines,
    tables: partial.tables,
    executionTimeMs: 1,
    pdfInfo: {}
  };
}

test('normalize binds Line Total to amount', () => {
  assert.equal(normalizeKey('Line Total'), 'linetotal');
  assert.equal(normalizeKey('invoice #'), 'invoiceno');
});

test('money parse treats 1,234 as thousands and (10.00) as negative', () => {
  assert.equal(parseMoneyToMinor('1,234', 'USD'), 123400);
  assert.equal(parseMoneyToMinor('(10.00)', 'USD'), -1000);
  assert.equal(parseMoneyToMinor('USD 20.00', 'USD'), 2000);
});

test('currency detect does not default USD', () => {
  assert.equal(detectCurrency(['no money here']), null);
  assert.equal(detectCurrency(['Amount due  ₹ 220.00']), 'INR');
});

test('PASS when invoice number exists and totals close', () => {
  const result = closeInvoice(model({
    page1Lines: [
      'Vendor: Acme Supplies',
      'Invoice No: INV-1001',
      'Invoice Date: 2026-09-01'
    ],
    tables: [table(
      ['description', 'qty', 'unit_price', 'amount'],
      [
        ['Hosting', '1', '100.00', '100.00'],
        ['Licenses', '2', '50.00', '100.00'],
        ['Tax', '-', '-', '20.00'],
        ['Amount due', '-', '-', 'USD 220.00']
      ]
    )]
  }));

  assert.equal(result.mapped, true);
  assert.equal(result.invoiceNumber, 'INV-1001');
  assert.equal(result.vendor, 'Acme Supplies');
  assert.equal(result.currency, 'USD');
  assert.equal(result.lines.length, 2);
  assert.equal(result.taxMinor, 2000);
  assert.equal(result.statedTotalMinor, 22000);
  assert.equal(result.status, 'PASS');
  assert.equal(result.lines.every((line) => line.lineCheck === 'PASS'), true);
});

test('FAIL remainder when stated total is wrong', () => {
  const result = closeInvoice(model({
    page1Lines: ['Invoice No: INV-9'],
    tables: [table(
      ['item', 'qty', 'rate', 'line_total'],
      [
        ['Widget', '1', '10.00', '10.00'],
        ['Total', '-', '-', 'USD 99.00']
      ]
    )]
  }));

  assert.equal(result.status, 'FAIL');
  assert.match(result.statusCopy, /remainder/);
});

test('FAIL no text layer still produces a close', () => {
  const result = closeInvoice(model({
    rawText: '   ',
    page1Lines: [],
    tables: []
  }));
  assert.equal(result.statusCopy, 'FAIL: no text layer');
});

test('FAIL invoice_number missing even if totals pass', () => {
  const result = closeInvoice(model({
    page1Lines: ['Vendor: No Number Inc'],
    tables: [table(
      ['description', 'qty', 'price', 'amount'],
      [
        ['A', '1', '5.00', '5.00'],
        ['Total', '-', '-', 'USD 5.00']
      ]
    )]
  }));
  assert.equal(result.status, 'FAIL');
  assert.equal(result.statusCopy, 'FAIL: invoice_number missing');
});

test('unmapped columns become no line table', () => {
  const result = closeInvoice(model({
    page1Lines: ['Invoice No: INV-2'],
    tables: [table(
      ['line_number', 'extracted_content'],
      [['1', 'Hosting 100']]
    )]
  }));
  assert.equal(result.statusCopy, 'FAIL: no line table');
});

test('line check fails when qty * rate != amount', () => {
  const result = closeInvoice(model({
    page1Lines: ['Invoice No: INV-3'],
    tables: [table(
      ['description', 'qty', 'unit_price', 'amount'],
      [
        ['Bad math', '2', '10.00', '50.00'],
        ['Total', '-', '-', 'USD 50.00']
      ]
    )]
  }));
  assert.equal(result.lines[0].lineCheck, 'FAIL');
});

test('workbook always has Invoice and Raw extract sheets', async () => {
  const result = closeInvoice(model({
    page1Lines: ['Invoice No: INV-1001'],
    tables: [table(
      ['description', 'qty', 'unit_price', 'amount'],
      [
        ['Hosting', '1', '10.00', '10.00'],
        ['Total', '-', '-', 'USD 10.00']
      ]
    )]
  }));
  const buffer = await workbookFromClose(result);
  assert.ok(buffer.length > 100);
  assert.equal(buffer.subarray(0, 2).toString('utf8'), 'PK');
});
