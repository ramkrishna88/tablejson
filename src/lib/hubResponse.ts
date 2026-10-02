export const EXAMPLE_INVOICE_RESPONSE = {
  status: 'success',
  checksum: 'PASS',
  checksum_copy: 'PASS',
  vendor: 'Acme Supplies',
  invoice_number: 'INV-1001',
  date: '2026-09-01',
  currency: 'USD',
  stated_total: '220.00',
  expected_total: '220.00',
  remainder: '0.00',
  shipping: '0.00',
  tax: '20.00',
  discount: '0.00',
  lines: [
    {
      description: 'Hosting',
      qty: '1',
      unit_price: '100.00',
      amount: '100.00',
      line_check: 'PASS'
    },
    {
      description: 'Licenses',
      qty: '2',
      unit_price: '50.00',
      amount: '100.00',
      line_check: 'PASS'
    }
  ]
};

export const EXAMPLE_EXTRACT_RESPONSE = {
  status: 'success',
  filename: 'example.pdf',
  total_pages: 1,
  tables_found: 1,
  metadata: {
    execution_time_ms: 12,
    extraction_mode: 'text'
  },
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
};
