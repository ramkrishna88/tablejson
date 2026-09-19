import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputPath = path.join(__dirname, '..', 'sample_12mb_large_report.pdf');

function generateLargePDF() {
  console.log('🚀 Generating 12MB Large PDF document (this will contain 10,000+ table rows)...');

  const doc = new PDFDocument({ margin: 30, size: 'A4', compress: false });
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // Title & Header
  doc.fontSize(18).font('Helvetica-Bold').text('ACME CORP — ENTERPRISE MULTI-YEAR LEDGER REPORT', { align: 'center' });
  doc.fontSize(9).font('Helvetica').text('CONFIDENTIAL & PROPRIETARY — 10,000 RECORD TRANSACTION STREAM', { align: 'center' });
  doc.moveDown(1);

  const headers = 'Date        Trans_ID    Description                       Category     Qty   Amount';
  doc.fontSize(8).font('Helvetica-Bold');
  doc.text(headers);
  doc.text('---------------------------------------------------------------------------------------------------');

  doc.font('Helvetica');

  const categories = ['DevOps', 'IT Tools', 'Operations', 'Marketing', 'Legal', 'SaaS', 'Sales', 'Compliance'];
  
  // Write 40,000 rows to generate a ~12MB PDF file
  const totalRows = 40000;
  for (let i = 1; i <= totalRows; i++) {
    const day = String((i % 28) + 1).padStart(2, '0');
    const month = String((i % 12) + 1).padStart(2, '0');
    const year = 2020 + (i % 6);
    const dateStr = `${year}-${month}-${day}`;
    const txnId = `TXN-${10000 + i}`;
    const category = categories[i % categories.length];
    const qty = String((i % 50) + 1);
    const amount = `$${( (i * 17.35) % 9999 ).toFixed(2)}`;
    const desc = `Enterprise Service Contract Allocation #${i}`.padEnd(32, ' ');

    const line = `${dateStr}  ${txnId}    ${desc}   ${category.padEnd(10, ' ')}   ${qty.padEnd(4, ' ')}  ${amount}`;
    doc.text(line);

    if (i % 2500 === 0) {
      console.log(`... Generated ${i} / ${totalRows} rows`);
    }
  }

  doc.end();

  stream.on('finish', () => {
    const stats = fs.statSync(outputPath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`\n✅ Large PDF generated successfully!`);
    console.log(`- File Path: ${outputPath}`);
    console.log(`- File Size: ${fileSizeInMB} MB`);
    console.log(`- Total Rows: ${totalRows}`);
  });
}

generateLargePDF();
