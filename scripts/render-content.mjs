import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { page } from './layout.mjs';

mkdirSync(new URL('../src/public/guides/', import.meta.url), { recursive: true });

function plainText(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
}

function withHeadingIds(html) {
  const items = [];
  const seen = new Set();
  const body = html.replace(/<h3>([\s\S]*?)<\/h3>/gi, (_, inner) => {
    const text = plainText(inner);
    let id = slugify(text);
    if (seen.has(id)) id = `${id}-${seen.size}`;
    seen.add(id);
    items.push({ id, text });
    return `<h3 id="${id}">${inner}</h3>`;
  });
  const toc = items.map((item) => `<a href="#${item.id}">${item.text}</a>`).join('\n        ');
  return { body, toc };
}

function withFaqIds(html) {
  const items = [];
  let n = 0;
  const body = html.replace(/<details class="faq"([^>]*)>\s*<summary>([\s\S]*?)<\/summary>/g, (_, attrs, summary) => {
    n += 1;
    const text = plainText(summary);
    const id = `q${n}`;
    items.push({ id, text });
    const open = /\bopen\b/.test(attrs) ? ' open' : '';
    return `<details class="faq" id="${id}"${open}><summary>${summary}</summary>`;
  });
  const toc = items.map((item) => `<a href="#${item.id}">${item.text}</a>`).join('\n        ');
  return { body, toc };
}

const pages = [
  ['about.html', 'about.html', 'read', {
    title: 'About — TableJSON',
    description: 'TableJSON is run by Venkata Naidu. It turns text-layer PDF tables into JSON, and invoices into a checksummed Excel file.',
    path: '/about',
    active: 'about'
  }],
  ['privacy.html', 'privacy.html', 'read', {
    title: 'Privacy — TableJSON',
    description: 'How TableJSON handles PDF uploads, temporary files, cookies, and Google AdSense advertising.',
    path: '/privacy',
    active: 'privacy'
  }],
  ['terms.html', 'terms.html', 'read', {
    title: 'Terms — TableJSON',
    description: 'Terms of use for the TableJSON playground and API, including file rights, limits, ads, and no warranty.',
    path: '/terms',
    active: 'terms'
  }],
  ['how-it-works.html', 'how-it-works.html', 'read', {
    title: 'How it works — TableJSON',
    description: 'How TableJSON reads a text-layer PDF, returns table JSON, and checks an invoice before the Excel file downloads.',
    path: '/how-it-works',
    active: 'how'
  }],
  ['faq.html', 'faq.html', 'faq', {
    title: 'FAQ — TableJSON',
    description: 'Short answers on scans, file retention, accounts, Excel, and size limits for TableJSON.',
    path: '/faq',
    active: 'faq'
  }],
  ['contact.html', 'contact.html', 'listing', {
    title: 'Contact — TableJSON',
    description: 'Contact TableJSON at hello@tablejson.com. The form opens your email app and is not stored on the server.',
    path: '/contact',
    active: 'contact'
  }],
  ['guides-index.html', 'guides/index.html', 'listing', {
    title: 'Guides — TableJSON',
    description: 'Practical guides for extracting PDF tables to JSON, invoices to Excel, scans versus text-layer files, and the API.',
    path: '/guides',
    active: 'guides'
  }]
];

const guides = [
  ['extracting-tables-from-pdf-to-json', 'Extracting PDF tables to JSON — TableJSON', 'How TableJSON turns a text-layer PDF table into JSON, including headers, raw cells, page ranges, and the fallback line table.', 'Extracting tables from a PDF into JSON', 'Headers, raw cells, and the fallback line table.'],
  ['invoice-pdf-to-excel-and-csv', 'Invoice PDF to Excel or CSV — TableJSON', 'Turn a text-layer invoice PDF into a checksummed Excel workbook, then save CSV from the sheet that actually balanced.', 'Invoice PDF to Excel or CSV', 'Checksummed workbook, then CSV from the sheet.'],
  ['text-layer-vs-scanned-pdfs', 'Text-layer vs scanned PDFs — TableJSON', 'How to tell a text-layer PDF from a scan, and what TableJSON returns when the page is only a picture.', 'Text-layer PDFs and scans', 'The highlight test, and what a picture returns.'],
  ['cleaning-messy-table-json', 'Cleaning messy table JSON — TableJSON', 'Fix PDF table JSON when the title became the header, a column slid left, or page numbers landed in the rows.', 'Cleaning messy table JSON', 'Bad headers, shifted columns, page furniture.'],
  ['bank-statement-pdfs-to-spreadsheets', 'Bank statement PDFs to a spreadsheet — TableJSON', 'Extract a text-layer bank statement to JSON and repair blank debit or credit cells before you trust the balance.', 'Bank statements to a spreadsheet', 'Blank amount cells and the opening balance.'],
  ['json-vs-csv-for-table-data', 'JSON vs CSV for table data — TableJSON', 'When to keep TableJSON output as JSON and when to write a quoted CSV without losing SKUs or commas.', 'JSON or CSV for table data', 'When to keep the tree, and when to write CSV.'],
  ['automate-pdf-table-extraction', 'Automate PDF table extraction — TableJSON', 'Call the TableJSON API from a script: keys, file limits, a folder loop, and which responses must not be imported.', 'Automating PDF table extraction', 'Keys, limits, and responses you should not import.']
];

function readContent(name) {
  return readFileSync(new URL(`../src/content/${name}`, import.meta.url), 'utf8').trim();
}

for (const [source, dest, layout, meta] of pages) {
  let body = readContent(source);
  let toc = '';
  if (layout === 'faq') {
    ({ body, toc } = withFaqIds(body));
  } else if (layout === 'read') {
    ({ body, toc } = withHeadingIds(body));
  }
  writeFileSync(
    new URL(`../src/public/${dest}`, import.meta.url),
    page({ ...meta, body, toc, layout: layout === 'faq' ? 'read' : layout })
  );
}

for (const [slug, title, description, cardTitle, blurb] of guides) {
  let body = readFileSync(new URL(`../src/content/guides/${slug}.html`, import.meta.url), 'utf8').trim();
  const headed = withHeadingIds(body);
  body = headed.body;
  const index = guides.findIndex((guide) => guide[0] === slug);
  const relatedItems = [1, 2, 3].map((step) => guides[(index + step) % guides.length]);
  const related = `<section class="related" aria-label="Related guides">
      <h2>Related guides</h2>
      <div class="guide-grid">
        ${relatedItems.map((guide) => `<a class="guide-card" href="/guides/${guide[0]}"><strong>${guide[3]}</strong><span>${guide[4]}</span></a>`).join('\n        ')}
      </div>
    </section>`;
  writeFileSync(
    new URL(`../src/public/guides/${slug}.html`, import.meta.url),
    page({
      title,
      description,
      path: `/guides/${slug}`,
      active: 'guides',
      body,
      toc: headed.toc,
      related
    })
  );
}

console.log('rendered');
