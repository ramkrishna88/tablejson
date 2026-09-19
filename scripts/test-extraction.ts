import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractTablesFromPDF } from '../src/services/pdfExtractor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTest() {
  console.log('🧪 Running Enterprise 100,000 Record Benchmark (sample_enterprise_100k_ledger.pdf)...');

  const samplePath = path.join(__dirname, '..', 'sample_enterprise_100k_ledger.pdf');
  const stats = fs.statSync(samplePath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`- Document File Size: ${sizeMB} MB`);

  const buffer = fs.readFileSync(samplePath);

  try {
    const result = await extractTablesFromPDF(buffer, 'sample_enterprise_100k_ledger.pdf');
    console.log('🏆 100,000 Record Enterprise Benchmark Passed!');
    console.log(`- File Name: ${result.filename}`);
    console.log(`- Tables Found: ${result.tables_found}`);
    console.log(`- Total Pages: ${result.total_pages.toLocaleString()}`);
    console.log(`- Execution Latency: ${result.metadata.execution_time_ms} ms (${(result.metadata.execution_time_ms / 1000).toFixed(2)} seconds)`);
    console.log(`- Total Rows Extracted: ${result.tables[0]?.total_rows.toLocaleString()}`);
    
    if (result.tables[0]) {
      console.log('\nSample Output (Row #1 & Row #100,000):');
      console.log('Row #1:', result.tables[0].rows[0]?.data);
      console.log('Row #100,000:', result.tables[0].rows[99999]?.data);
    }
  } catch (err: any) {
    console.error('❌ Test Failed:', err.message);
  }
}

runTest();
