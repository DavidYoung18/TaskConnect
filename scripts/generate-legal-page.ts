// Generates legal/index.html (the public Terms & Privacy page hosted on Firebase
// Hosting for App Store / Play Store review links) from the same English copy
// shown in-app at src/app/terms-privacy.tsx, so the two never drift apart.
//
// Run after editing src/locales/en/common.json's termsScreen.* keys:
//   npx tsx scripts/generate-legal-page.ts
// Then redeploy: npx firebase-tools deploy --only hosting:legal

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');
const en = JSON.parse(readFileSync(join(ROOT, 'src/locales/en/common.json'), 'utf-8'));
const ts = en.termsScreen;

function entries(prefix: string, count: number) {
  return Array.from({ length: count }, (_, i) => i + 1).map((n) => ({
    title: ts[`${prefix}${n}Title`],
    body: ts[`${prefix}${n}Body`],
  }));
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function section(heading: string, items: { title: string; body: string }[]) {
  return `
      <h2>${esc(heading)}</h2>
      ${items
        .map(
          (e) => `
      <h3>${esc(e.title)}</h3>
      <p>${esc(e.body)}</p>`
        )
        .join('')}
`;
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(ts.title)} — Labbe</title>
<style>
  :root { color-scheme: light; }
  body {
    margin: 0;
    background: #ffffff;
    color: #111111;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6;
  }
  header {
    background: #021E4B;
    color: #ffffff;
    padding: 40px 24px 32px;
  }
  header h1 {
    margin: 0 0 6px;
    font-size: 28px;
    font-weight: 800;
    font-style: italic;
  }
  header p {
    margin: 0;
    color: rgba(255,255,255,0.7);
    font-size: 14px;
  }
  main {
    max-width: 720px;
    margin: 0 auto;
    padding: 32px 24px 80px;
  }
  h2 {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #666666;
    margin: 40px 0 16px;
    border-bottom: 1px solid #e8e8e8;
    padding-bottom: 8px;
  }
  h2:first-of-type { margin-top: 0; }
  h3 {
    font-size: 17px;
    margin: 24px 0 6px;
  }
  p {
    margin: 0 0 4px;
    color: #333333;
    font-size: 15px;
  }
</style>
</head>
<body>
<header>
  <h1>Labbe</h1>
  <p>${esc(ts.title)} &middot; ${esc(ts.lastUpdated)}</p>
</header>
<main>
${section(ts.termsHeading, entries('terms', 10))}
${section(ts.privacyHeading, entries('privacy', 6))}
</main>
</body>
</html>
`;

writeFileSync(join(ROOT, 'legal/index.html'), html);
console.log('wrote legal/index.html');
