const TABS = [
  ['/', 'Tool', 'tool'],
  ['/guides', 'Guides', 'guides'],
  ['/how-it-works', 'How it works', 'how'],
  ['/faq', 'FAQ', 'faq'],
  ['/docs', 'API/Docs', 'docs'],
  ['/about', 'About', 'about'],
  ['/contact', 'Contact', 'contact']
];

export function navHtml(active) {
  return TABS.map(([href, label, key]) => {
    const on = key === active ? ' class="on" aria-current="page"' : '';
    return `<a href="${href}"${on}>${label}</a>`;
  }).join('\n      ');
}

export function footerHtml() {
  return `<footer>
    <nav>
      <a href="/">Tool</a>
      <a href="/guides">Guides</a>
      <a href="/how-it-works">How it works</a>
      <a href="/faq">FAQ</a>
      <a href="/docs">API/Docs</a>
      <a href="/about">About</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
      <a href="/contact">Contact</a>
    </nav>
    <p>Text-layer PDFs only. An upload is written to a temporary file for that request and deleted when the response is sent.</p>
  </footer>`;
}

export function page({ title, description, path, active, body, toc = '', related = '', layout = 'read' }) {
  const canonical = `https://tablejson.com${path}`;
  const article = `<main class="legal">
    <article id="article-body">
${body}
    </article>
  </main>`;
  let main;
  if (layout === 'listing') {
    main = `<div class="shell"><main class="plain">
${body}
    </main></div>`;
  } else if (toc) {
    main = `<div class="shell">
    <div class="read-grid">
      <nav class="toc" aria-label="On this page">
        <p class="toc-label">On this page</p>
        ${toc}
      </nav>
      ${article}
    </div>
    ${related}
  </div>`;
  } else {
    main = `<div class="shell"><div class="read-grid">${article}</div></div>`;
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1210860150241703" crossorigin="anonymous"></script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="google-adsense-account" content="ca-pub-1210860150241703">
  <link rel="canonical" href="${canonical}">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="icon" href="/favicon.ico?v=2" sizes="any">
  <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png?v=2">
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png?v=2">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2">
  <link rel="manifest" href="/site.webmanifest">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="https://tablejson.com/og.png">
  <meta name="theme-color" content="#0b0f19">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/site.css?v=5">
</head>
<body>
  <header class="topbar">
    <a class="logo-container" href="/">
      <img class="logo-icon" src="/icon-192.png?v=2" width="36" height="36" alt="TableJSON">
      <div class="logo-text">TableJSON</div>
    </a>
    <nav class="tabs" aria-label="Primary">
      ${navHtml(active)}
    </nav>
  </header>
  ${main}
  ${footerHtml()}
</body>
</html>
`;
}

export function wordCount(html) {
  const match = html.match(/<article id="article-body">([\s\S]*?)<\/article>/);
  const inner = match ? match[1] : html;
  const text = inner
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[#a-z0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return 0;
  return text.split(' ').filter(Boolean).length;
}
