import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputPath = path.join(__dirname, '..', 'sample_financial_report.pdf');

function generateSamplePDF() {
  const doc = new PDFDocument({ margin: 40, size: 'A4', compress: false });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // Title & Header
  doc.fontSize(16).font('Helvetica-Bold').text('ACME CORP — ANNUAL FINANCIAL REPORT', { align: 'center' });
  doc.fontSize(10).font('Helvetica').text('Report Generated: 2026-09-19 | Department: Finance & Analytics', { align: 'center' });
  doc.moveDown(1.5);

  // SECTION 1: Monthly Transactions Table
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#10b981').text('1. Monthly Operations & Transactions');
  doc.moveDown(0.5);

  const table1Headers = 'Date        Trans_ID    Description                       Category     Qty   Amount';
  const table1Data = [
    '2026-01-05  TXN-1001    Cloud Infrastructure Hosting       DevOps       1     $1,250.00',
    '2026-01-12  TXN-1002    Enterprise Software Licenses       IT Tools     15    $4,500.00',
    '2026-01-18  TXN-1003    Office Equipment & Supplies        Operations   8     $850.50',
    '2026-01-25  TXN-1004    Digital Marketing Campaign         Marketing    1     $3,200.00',
    '2026-02-02  TXN-1005    Legal Advisory Services            Legal        5     $2,100.00',
    '2026-02-10  TXN-1006    Customer Support Platform          SaaS         1     $950.00',
    '2026-02-15  TXN-1007    Hardware Workstations              IT Assets    4     $6,400.00',
    '2026-02-22  TXN-1008    Staff Training & Workshops         HR           12    $1,800.00',
    '2026-03-01  TXN-1009    Security Audit Services            Compliance   1     $5,000.00',
    '2026-03-14  TXN-1010    Travel & Lodging Expenses          Sales        3     $1,420.00'
  ];

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#000');
  doc.text(table1Headers);
  doc.text('---------------------------------------------------------------------------------------------------');

  doc.font('Helvetica');
  table1Data.forEach(row => {
    doc.text(row);
  });

  doc.moveDown(2);

  // SECTION 2: Regional Performance Table
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#3b82f6').text('2. Regional Revenue & Sales Breakdown');
  doc.moveDown(0.5);

  const table2Headers = 'Region            Sales_Rep         Units_Sold   Total_Revenue';
  const table2Data = [
    'North America     Sarah Jenkins     1,450        $145,000.00',
    'Europe & UK       David Miller      1,120        $112,000.00',
    'Asia Pacific      Lin Zhang         980          $98,000.00',
    'Latin America     Carlos Gomez      650          $65,000.00'
  ];

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#000');
  doc.text(table2Headers);
  doc.text('---------------------------------------------------------------------------------------------------');

  doc.font('Helvetica');
  table2Data.forEach(row => {
    doc.text(row);
  });

  doc.end();

  stream.on('finish', () => {
    console.log(`✅ Sample PDF generated at: ${outputPath}`);
  });
}

generateSamplePDF();
