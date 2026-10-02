module.exports = {
  key: 'invoice_xlsx',
  noun: 'Invoice',
  display: {
    label: 'Invoice PDF to Excel',
    description: 'Turn a text-layer invoice PDF into a checksummed Excel workbook.'
  },
  operation: {
    inputFields: [
      {
        key: 'file',
        label: 'Invoice PDF',
        type: 'file',
        required: true,
        helpText:
          'A text-layer invoice PDF. Scanned files still return Excel, with checksum FAIL. See the [API docs](https://tablejson.com/docs).'
      }
    ],
    perform: async (z, bundle) => {
      const headers = {
        'X-API-Key': bundle.authData.api_key
      };
      const body = {
        file: bundle.inputData.file
      };

      const preview = await z.request({
        url: 'https://tablejson.com/v1/invoice-xlsx?format=json',
        method: 'POST',
        headers,
        body
      });

      const xlsxRes = await z.request({
        url: 'https://tablejson.com/v1/invoice-xlsx',
        method: 'POST',
        headers,
        body,
        raw: true
      });

      const safeName = String(preview.data.invoice_number || 'invoice').replace(/[^\w.-]+/g, '_') || 'invoice';
      const xlsx = await z.stashFile(
        xlsxRes,
        undefined,
        `${safeName}.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      return {
        ...preview.data,
        xlsx
      };
    },
    sample: {
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
        }
      ],
      xlsx: 'https://zapier-dev-files.s3.amazonaws.com/cli-platform/invoice.xlsx'
    },
    outputFields: [
      { key: 'checksum', label: 'Checksum' },
      { key: 'checksum_copy', label: 'Checksum copy' },
      { key: 'vendor', label: 'Vendor' },
      { key: 'invoice_number', label: 'Invoice number' },
      { key: 'date', label: 'Date' },
      { key: 'currency', label: 'Currency' },
      { key: 'stated_total', label: 'Stated total' },
      { key: 'expected_total', label: 'Expected total' },
      { key: 'xlsx', label: 'Excel file', type: 'file' }
    ]
  }
};
