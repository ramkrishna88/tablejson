export function page({ title, description, path, active, body }) {
  const canonical = `https://tablejson.com${path}`;
  const items = [
    ['/', 'Playground', 'playground'],
    ['/guides', 'Guides', 'guides'],
    ['/docs', 'Docs', 'docs'],
    ['/about', 'About', 'about'],
    ['/privacy', 'Privacy', 'privacy'],
    ['/terms', 'Terms', 'terms'],
    ['/contact', 'Contact', 'contact']
  ];
  const nav = items
    .map(([href, label, key]) => `<a href="${href}"${key === active ? ' class="on"' : ''}>${label}</a>`)
    .join('\n      ');
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
  <link rel="stylesheet" href="/site.css?v=4">
</head>
<body>
  <header>
    <a class="logo-container" href="/">
      <img class="logo-icon" src="/icon-192.png?v=2" width="36" height="36" alt="TableJSON">
      <div class="logo-text">TableJSON</div>
    </a>
    <nav class="header-links">
      ${nav}
    </nav>
  </header>
  <main class="legal">
    <article id="article-body">
${body}
    </article>
  </main>
  <footer>
    <nav>
      <a href="/">Playground</a>
      <a href="/guides">Guides</a>
      <a href="/docs">Docs</a>
      <a href="/about">About</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
      <a href="/contact">Contact</a>
    </nav>
    <p>Text-layer PDFs only. An upload is written to a temporary file for that request and deleted when the response is sent. Contact: <a href="mailto:hello@tablejson.com">hello@tablejson.com</a></p>
  </footer>
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
