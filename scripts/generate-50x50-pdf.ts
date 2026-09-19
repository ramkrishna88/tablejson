import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputPath = path.join(__dirname, '..', 'sample_50x50_grid.pdf');

function generate50x50PDF() {
  console.log('🚀 Generating 50 Rows x 50 Columns Grid PDF document...');

  const doc = new PDFDocument({ margin: 20, size: [4200, 1500], compress: false });
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  doc.fontSize(14).font('Helvetica-Bold').text('WIDE GRID REPORT — 50 ROWS x 50 COLUMNS', { align: 'center' });
  doc.moveDown(1);

  // Build 50 Column Headers
  const headers: string[] = [];
  for (let c = 1; c <= 50; c++) {
    headers.push(`col_${c}`);
  }

  doc.fontSize(7).font('Helvetica-Bold').fillColor('#10b981');
  doc.text(headers.join(' | '));
  doc.text('----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------');

  doc.font('Helvetica').fillColor('#000');

  // Build 50 Horizontal Rows
  for (let r = 1; r <= 50; r++) {
    const rowCells: string[] = [];
    for (let c = 1; c <= 50; c++) {
      rowCells.push(`V_${r}_${c}`);
    }
    doc.text(rowCells.join(' | '));
  }

  doc.end();

  stream.on('finish', () => {
    const stats = fs.statSync(outputPath);
    const fileSizeInKB = (stats.size / 1024).toFixed(2);
    console.log(`\n✅ 50x50 Grid PDF generated successfully!`);
    console.log(`- File Path: ${outputPath}`);
    console.log(`- File Size: ${fileSizeInKB} KB`);
    console.log(`- Dimensions: 50 Rows x 50 Columns`);
  });
}

generate50x50PDF();
