
// Self-generated sitemap for all current pages.
export async function GET(context: { site?: URL }) {
  const site = context.site?.href ?? 'https://example.com/';
  const paths = [
    '',
    // Scan & read
    'tools/scanner', 'tools/qr-scan', 'tools/text-scan', 'tools/pdf-studio',
    // PDF tools
    'tools/pdf-tools', 'tools/compress-pdf', 'tools/organize-pdf', 'tools/split-pdf',
    'tools/remove-pages', 'tools/extract-pages', 'tools/rotate-pdf',
    'tools/add-page-numbers', 'tools/watermark-pdf',
    // Create & convert
    'tools/jpg-to-pdf', 'tools/pdf-to-jpg', 'tools/text-to-pdf',
    'tools/word-to-pdf', 'tools/pdf-to-word',
    'about', 'privacy-policy', 'terms',
  ];
  const urls = [
    ...paths.map((p) => new URL(p, site).href),
  ];
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n') +
    `\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
}
