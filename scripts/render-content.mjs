import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { page } from './layout.mjs';

mkdirSync(new URL('../src/public/guides/', import.meta.url), { recursive: true });

const pages = [
  ['about.html', 'about.html', {
    title: 'About — TableJSON',
    description: 'TableJSON is run by Venkata Naidu. It turns text-layer PDF tables into JSON, and invoices into a checksummed Excel file.',
    path: '/about',
    active: 'about'
  }],
  ['privacy.html', 'privacy.html', {
    title: 'Privacy — TableJSON',
    description: 'How TableJSON handles PDF uploads, temporary files, cookies, and Google AdSense advertising.',
    path: '/privacy',
    active: 'privacy'
  }],
  ['contact.html', 'contact.html', {
    title: 'Contact — TableJSON',
    description: 'Contact TableJSON at hello@tablejson.com. The form opens your email app and is not stored on the server.',
    path: '/contact',
    active: 'contact'
  }],
  ['terms.html', 'terms.html', {
    title: 'Terms — TableJSON',
    description: 'Terms of use for the TableJSON playground and API, including file rights, limits, ads, and no warranty.',
    path: '/terms',
    active: 'terms'
  }],
  ['guides-index.html', 'guides/index.html', {
    title: 'Guides — TableJSON',
    description: 'Practical guides for extracting PDF tables to JSON, invoices to Excel, scans versus text-layer files, and the API.',
    path: '/guides',
    active: 'guides'
  }]
];

const guides = [
  ['extracting-tables-from-pdf-to-json', 'Extracting PDF tables to JSON — TableJSON', 'How TableJSON turns a text-layer PDF table into JSON, including headers, raw cells, page ranges, and the fallback line table.'],
  ['invoice-pdf-to-excel-and-csv', 'Invoice PDF to Excel or CSV — TableJSON', 'Turn a text-layer invoice PDF into a checksummed Excel workbook, then save CSV from the sheet that actually balanced.'],
  ['text-layer-vs-scanned-pdfs', 'Text-layer vs scanned PDFs — TableJSON', 'How to tell a text-layer PDF from a scan, and what TableJSON returns when the page is only a picture.'],
  ['cleaning-messy-table-json', 'Cleaning messy table JSON — TableJSON', 'Fix PDF table JSON when the title became the header, a column slid left, or page numbers landed in the rows.'],
  ['bank-statement-pdfs-to-spreadsheets', 'Bank statement PDFs to a spreadsheet — TableJSON', 'Extract a text-layer bank statement to JSON and repair blank debit or credit cells before you trust the balance.'],
  ['json-vs-csv-for-table-data', 'JSON vs CSV for table data — TableJSON', 'When to keep TableJSON output as JSON and when to write a quoted CSV without losing SKUs or commas.'],
  ['automate-pdf-table-extraction', 'Automate PDF table extraction — TableJSON', 'Call the TableJSON API from a script: keys, file limits, a folder loop, and which responses must not be imported.']
];

for (const [source, dest, meta] of pages) {
  const body = readFileSync(new URL(`../src/content/${source}`, import.meta.url), 'utf8').trim();
  writeFileSync(new URL(`../src/public/${dest}`, import.meta.url), page({ ...meta, body }));
}

for (const [slug, title, description] of guides) {
  const body = readFileSync(new URL(`../src/content/guides/${slug}.html`, import.meta.url), 'utf8').trim();
  writeFileSync(
    new URL(`../src/public/guides/${slug}.html`, import.meta.url),
    page({ title, description, path: `/guides/${slug}`, active: 'guides', body })
  );
}

const homeBody = readFileSync(new URL('../src/content/home.html', import.meta.url), 'utf8').trim();
const indexPath = new URL('../src/public/index.html', import.meta.url);
const index = readFileSync(indexPath, 'utf8');
const next = index.replace(
  /<!-- article-body:start -->[\s\S]*?<!-- article-body:end -->/,
  `<!-- article-body:start -->\n    <article class="story" id="article-body">\n${homeBody}\n    </article>\n    <!-- article-body:end -->`
);
if (!index.includes('<!-- article-body:start -->') || !index.includes('<!-- article-body:end -->')) {
  throw new Error('index.html article markers missing');
}
if (next !== index) {
  writeFileSync(indexPath, next);
}
console.log('rendered');
