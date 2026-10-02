import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(__dirname, '..', 'src', 'public', 'sample-invoice.pdf');

const doc = new PDFDocument({ margin: 48, size: 'A4', compress: false });
const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

doc.fontSize(16).font('Helvetica-Bold').text('Acme Supplies');
doc.moveDown(0.4);
doc.fontSize(11).font('Helvetica').text('Vendor: Acme Supplies');
doc.text('Invoice No: INV-1001');
doc.text('Invoice Date: 2026-09-01');
doc.moveDown(1);
doc.font('Helvetica-Bold').text('description          qty          unit_price          amount');
doc.font('Helvetica');
doc.text('Hosting              1            100.00              100.00');
doc.text('Licenses             2            50.00               100.00');
doc.text('Tax                  -            -                   20.00');
doc.text('Amount due           -            -                   USD 220.00');
doc.end();

stream.on('finish', () => {
  console.log(`Wrote ${outputPath} (${fs.statSync(outputPath).size} bytes)`);
});
