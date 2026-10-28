import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { after, describe, test } from 'node:test';
import { fastify } from './server.js';

after(async () => {
  await fastify.close();
});

const APEX = {
  host: 'tablejson.com',
  'x-forwarded-proto': 'https'
};

function visibleWords(html: string): number {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[#a-z0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.split(' ').filter(Boolean).length : 0;
}

function wordsFromArticle(html: string): number {
  const match = html.match(/<article\b[^>]*\bid="article-body"[^>]*>([\s\S]*?)<\/article>/);
  assert.ok(match, 'page is missing article#article-body');
  return visibleWords(match[1]);
}

function homeWords(html: string): number {
  const hero = html.match(/<section class="hero">([\s\S]*?)<\/section>/);
  const copy = html.match(/<section class="home-copy" id="home-copy">([\s\S]*?)<\/section>/);
  assert.ok(hero && copy, 'home is missing the short intro');
  return visibleWords(hero[1] + copy[1]);
}

function canonicalHref(html: string): string {
  const tags = [...html.matchAll(/<link\b[^>]*>/gi)].filter((match) => /rel="canonical"/i.test(match[0]));
  assert.equal(tags.length, 1, 'expected one canonical link');
  const href = tags[0][0].match(/href="([^"]+)"/);
  assert.ok(href, 'canonical link has no href');
  return href[1];
}

describe('AdSense readiness', () => {
  test('sitemap URLs are indexable HTML with canonical and AdSense meta', async () => {
    const sitemap = await fastify.inject({ method: 'GET', url: '/sitemap.xml', headers: APEX });
    assert.equal(sitemap.statusCode, 200);
    assert.doesNotMatch(sitemap.body, /\/home</);
    const locs = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    const lastmods = [...sitemap.body.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((match) => match[1]);
    assert.ok(locs.length >= 12);
    assert.equal(lastmods.length, locs.length);
    for (const lastmod of lastmods) {
      assert.match(lastmod, /^\d{4}-\d{2}-\d{2}$/);
    }

    const counts: Record<string, number> = {};
    for (const loc of locs) {
      const url = new URL(loc);
      assert.equal(url.origin, 'https://tablejson.com');
      const response = await fastify.inject({ method: 'GET', url: url.pathname, headers: APEX });
      assert.equal(response.statusCode, 200, loc);
      assert.match(response.headers['content-type'] as string, /text\/html/);
      assert.equal(canonicalHref(response.body), loc);
      const ads = response.body.match(/<meta name="google-adsense-account" content="ca-pub-1210860150241703">/g) || [];
      assert.equal(ads.length, 1, loc);
      assert.doesNotMatch(response.body, /noindex/i, loc);
      assert.match(response.body, /adsbygoogle\.js\?client=ca-pub-1210860150241703/);
      const header = response.body.split('</header>')[0];
      for (const label of ['Tool', 'Guides', 'How it works', 'FAQ', 'API/Docs', 'About', 'Contact']) {
        assert.match(header, new RegExp(`>${label}<`), loc);
      }
      if (url.pathname === '/contact') {
        assert.match(response.body, /mailto:hello@tablejson.com/);
        assert.match(response.body, /id="contact-form"/);
      } else {
        assert.doesNotMatch(response.body, /mailto:/, loc);
        assert.doesNotMatch(response.body, /id="contact-form"/, loc);
      }
      if (url.pathname.startsWith('/guides/')) {
        counts[url.pathname] = wordsFromArticle(response.body);
        assert.match(response.body, /class="toc"/, loc);
        assert.match(response.body, /class="related"/, loc);
      }
      if (url.pathname === '/') {
        counts['/'] = homeWords(response.body);
        assert.doesNotMatch(response.body, /FAQPage/);
      }
      if (url.pathname === '/faq') {
        assert.match(response.body, /<details class="faq"/);
        assert.match(response.body, /"@type": "FAQPage"/);
      }
    }

    assert.ok(counts['/'] >= 150 && counts['/'] <= 250, `home words ${counts['/']}`);
    const guidePaths = Object.keys(counts).filter((path) => path.startsWith('/guides/'));
    assert.ok(guidePaths.length >= 6 && guidePaths.length <= 8);
    for (const path of guidePaths) {
      assert.ok(counts[path] >= 900 && counts[path] <= 1300, `${path} words ${counts[path]}`);
    }
  });

  test('redirects www and http, but never redirects apex /ads.txt', async () => {
    const www = await fastify.inject({
      method: 'GET',
      url: '/guides?from=www',
      headers: { host: 'www.tablejson.com', 'x-forwarded-proto': 'https' }
    });
    assert.equal(www.statusCode, 301);
    assert.equal(www.headers.location, 'https://tablejson.com/guides?from=www');

    const http = await fastify.inject({
      method: 'GET',
      url: '/privacy',
      headers: { host: 'tablejson.com', 'x-forwarded-proto': 'http' }
    });
    assert.equal(http.statusCode, 301);
    assert.equal(http.headers.location, 'https://tablejson.com/privacy');

    const wwwHttpHome = await fastify.inject({
      method: 'GET',
      url: '/home?ref=old',
      headers: { host: 'www.tablejson.com', 'x-forwarded-proto': 'http' }
    });
    assert.equal(wwwHttpHome.statusCode, 301);
    assert.equal(wwwHttpHome.headers.location, 'https://tablejson.com/?ref=old');

    const adsHttp = await fastify.inject({
      method: 'GET',
      url: '/ads.txt',
      headers: { host: 'tablejson.com', 'x-forwarded-proto': 'http' }
    });
    assert.equal(adsHttp.statusCode, 200);
    assert.equal(adsHttp.headers.location, undefined);
    assert.match(adsHttp.body, /pub-1210860150241703/);

    const adsWww = await fastify.inject({
      method: 'GET',
      url: '/ads.txt',
      headers: { host: 'www.tablejson.com', 'x-forwarded-proto': 'http' }
    });
    assert.equal(adsWww.statusCode, 301);
    assert.equal(adsWww.headers.location, 'https://tablejson.com/ads.txt');

    const local = await fastify.inject({
      method: 'GET',
      url: '/about',
      headers: { host: 'localhost:3000', 'x-forwarded-proto': 'http' }
    });
    assert.equal(local.statusCode, 200);

    const home = await fastify.inject({
      method: 'GET',
      url: '/home',
      headers: APEX
    });
    assert.equal(home.statusCode, 301);
    assert.equal(home.headers.location, '/');
  });

  test('browsers get an HTML 404 and /v1 stays JSON', async () => {
    const browser = await fastify.inject({
      method: 'GET',
      url: '/missing-page',
      headers: { ...APEX, accept: 'text/html,application/xhtml+xml' }
    });
    assert.equal(browser.statusCode, 404);
    assert.match(String(browser.headers['content-type']), /text\/html/);
    assert.match(browser.body, /That page is not here/);

    const api = await fastify.inject({
      method: 'GET',
      url: '/v1/missing',
      headers: { ...APEX, accept: 'text/html,application/xhtml+xml' }
    });
    assert.equal(api.statusCode, 404);
    assert.match(String(api.headers['content-type']), /application\/json/);
    assert.equal(api.json().error_code, 'NOT_FOUND');

    const client = await fastify.inject({
      method: 'GET',
      url: '/also-missing',
      headers: { ...APEX, accept: '*/*' }
    });
    assert.equal(client.statusCode, 404);
    assert.match(String(client.headers['content-type']), /application\/json/);
  });

  test('the playground header has one Docs link and does not claim uploads are never stored', async () => {
    const home = await fastify.inject({ method: 'GET', url: '/', headers: APEX });
    const header = home.body.split('</header>')[0];
    assert.equal((header.match(/>API\/Docs</g) || []).length, 1);
    assert.equal((header.match(/>\s*Docs\s*</g) || []).length, 0);
    assert.match(home.body, /href="\/guides"/);
    assert.doesNotMatch(home.body, /Uploads are not stored/);
    assert.match(home.body, /temporary file/);
    assert.equal(existsSync('vercel.json'), false);
    assert.equal(existsSync('src/public/home.html'), false);
    const guides = await fastify.inject({ method: 'GET', url: '/guides', headers: APEX });
    for (const slug of [
      'extracting-tables-from-pdf-to-json',
      'invoice-pdf-to-excel-and-csv',
      'text-layer-vs-scanned-pdfs',
      'cleaning-messy-table-json',
      'bank-statement-pdfs-to-spreadsheets',
      'json-vs-csv-for-table-data',
      'automate-pdf-table-extraction'
    ]) {
      assert.match(guides.body, new RegExp(`href="/guides/${slug}"`));
    }
    assert.equal(readFileSync('src/public/ads.txt', 'utf8').includes('pub-1210860150241703'), true);
  });
});
