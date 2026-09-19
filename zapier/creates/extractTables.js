module.exports = {
  key: 'extract_tables',
  noun: 'Table',
  display: {
    label: 'Extract Tables From PDF',
    description: 'Upload a PDF and get structured tables as JSON.'
  },
  operation: {
    inputFields: [
      {
        key: 'file',
        label: 'PDF File',
        type: 'file',
        required: true,
        helpText: 'A text-layer PDF. Scanned or image-only PDFs are not supported.'
      }
    ],
    perform: async (z, bundle) => {
      const response = await z.request({
        url: 'https://tablejson.com/v1/extract-tables',
        method: 'POST',
        headers: {
          'X-API-Key': bundle.authData.api_key
        },
        body: {
          file: bundle.inputData.file
        }
      });
      return response.data;
    },
    sample: {
      status: 'success',
      filename: 'invoice.pdf',
      total_pages: 1,
      tables_found: 1,
      metadata: {
        execution_time_ms: 42,
        extraction_mode: 'text'
      },
      tables: [
        {
          table_id: 1,
          page_number: 1,
          page_end: 1,
          headers: ['date', 'amount'],
          total_rows: 2,
          rows: [
            {
              row_index: 1,
              data: { date: '2026-01-05', amount: '1250.00' },
              raw_cells: ['2026-01-05', '1250.00']
            }
          ]
        }
      ]
    }
  }
};
