import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(__dirname, '..', 'src', 'public', 'sample-mini.pdf');

const doc = new PDFDocument({ margin: 40, size: 'A4', compress: false });
const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

doc.fontSize(14).font('Helvetica-Bold').text('TableJSON — 3-row sample', { align: 'center' });
doc.moveDown(1);
doc.fontSize(10).font('Helvetica-Bold').text('date        item            amount');
doc.text('----------------------------------------');
doc.font('Helvetica');
doc.text('2026-01-05  Hosting         1250.00');
doc.text('2026-01-12  Licenses        4500.00');
doc.text('2026-01-18  Supplies         850.50');
doc.end();

stream.on('finish', () => {
  console.log(`Wrote ${outputPath} (${fs.statSync(outputPath).size} bytes)`);
});
