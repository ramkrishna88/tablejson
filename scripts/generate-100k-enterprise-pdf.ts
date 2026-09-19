import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputPath = path.join(__dirname, '..', 'sample_enterprise_100k_ledger.pdf');

function generate100KPDF() {
  console.log('🚀 Generating 100,000 Record Enterprise Financial Ledger PDF document...');

  const doc = new PDFDocument({ margin: 25, size: 'A4', compress: false });
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // Title Header
  doc.fontSize(18).font('Helvetica-Bold').text('ENTERPRISE GLOBAL FINANCIAL LEDGER — 100,000 RECORDS', { align: 'center' });
  doc.fontSize(9).font('Helvetica').text('AUDITED FINANCIAL CONSOLIDATION REPORT | ACME ENTERPRISE CORP', { align: 'center' });
  doc.moveDown(1);

  const headers = 'Date        Trans_ID    Description                       Category     Qty   Amount';
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#10b981');
  doc.text(headers);
  doc.text('---------------------------------------------------------------------------------------------------');

  doc.font('Helvetica').fillColor('#000');

  const categories = ['Cloud Infrastructure', 'Enterprise License', 'Equipment Hardware', 'Global Marketing', 'Legal Advisory', 'Logistics Operations'];
  
  const totalRows = 100000;
  for (let i = 1; i <= totalRows; i++) {
    const day = String((i % 28) + 1).padStart(2, '0');
    const month = String((i % 12) + 1).padStart(2, '0');
    const year = 2020 + (i % 6);
    const dateStr = `${year}-${month}-${day}`;
    const txnId = `ENT-${100000 + i}`;
    const category = categories[i % categories.length].padEnd(20, ' ');
    const qty = String((i % 100) + 1).padEnd(4, ' ');
    const amount = `$${((i * 23.45) % 99999).toFixed(2)}`;
    const desc = `Enterprise Transaction Audit Record #${i}`.padEnd(32, ' ');

    const line = `${dateStr}  ${txnId}   ${desc}  ${category}  ${qty}  ${amount}`;
    doc.text(line);

    if (i % 25000 === 0) {
      console.log(`... Progress: ${i.toLocaleString()} / 100,000 rows generated`);
    }
  }

  doc.end();

  stream.on('finish', () => {
    const stats = fs.statSync(outputPath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`\n✅ 100,000 Record Enterprise PDF generated successfully!`);
    console.log(`- File Path: ${outputPath}`);
    console.log(`- File Size: ${fileSizeInMB} MB`);
    console.log(`- Total Records: ${totalRows.toLocaleString()} Rows`);
  });
}

generate100KPDF();
