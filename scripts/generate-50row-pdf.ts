import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputPath = path.join(__dirname, '..', 'sample_50_rows_invoice.pdf');

function generate50RowPDF() {
  console.log('🚀 Generating 50-Row E-Commerce Orders PDF document...');

  const doc = new PDFDocument({ margin: 35, size: 'A4', compress: false });
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // Title Header
  doc.fontSize(16).font('Helvetica-Bold').text('GLOBAL LOGISTICS — DAILY ORDERS REPORT', { align: 'center' });
  doc.fontSize(9).font('Helvetica').text('Batch ID: BATCH-2026-0919 | Total Records: 50 Orders', { align: 'center' });
  doc.moveDown(1.2);

  const headers = 'Order_ID    Customer_Name        Product_Name                Qty   Total_Price';
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#10b981');
  doc.text(headers);
  doc.text('---------------------------------------------------------------------------------------------------');

  doc.font('Helvetica').fillColor('#000');

  const names = ['Alice Smith', 'Bob Jones', 'Charlie Brown', 'Diana Prince', 'Evan Wright', 'Fiona Gallagher', 'George Clark', 'Hannah Abbott'];
  const products = ['Wireless Earbuds Pro', 'Ergonomic Desk Chair', '4K Ultra Monitor', 'Mechanical Keyboard', 'USB-C Multi-Hub', 'Smart Watch Gen 5'];

  for (let i = 1; i <= 50; i++) {
    const orderId = `ORD-${5000 + i}`;
    const name = names[i % names.length].padEnd(18, ' ');
    const product = products[i % products.length].padEnd(25, ' ');
    const qty = String((i % 5) + 1).padEnd(4, ' ');
    const price = `$${((i * 29.99) + 15.00).toFixed(2)}`;

    const line = `${orderId}    ${name}   ${product}   ${qty}  ${price}`;
    doc.text(line);
  }

  doc.end();

  stream.on('finish', () => {
    const stats = fs.statSync(outputPath);
    const fileSizeInKB = (stats.size / 1024).toFixed(2);
    console.log(`\n✅ 50-Row PDF generated successfully!`);
    console.log(`- File Path: ${outputPath}`);
    console.log(`- File Size: ${fileSizeInKB} KB`);
    console.log(`- Total Rows: 50`);
  });
}

generate50RowPDF();
