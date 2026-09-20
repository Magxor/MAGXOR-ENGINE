/**
 * Magxor Engine — genera sitemap.xml + robots.txt desde el endpoint Apps Script.
 * No usa Sheet ID ni CSV público. Falla suave a home si no hay endpoint en CI.
 * Uso: node scripts/generate-sitemap.mjs
 */
import fs from "fs";
import path from "path";

const ENDPOINT = process.env.VITE_APPS_SCRIPT_URL || "";
const TOKEN = process.env.VITE_READ_TOKEN || "";
const FALLBACK_DOMAIN = process.env.VITE_SITE_URL || "https://magxor-engine.example.com";

async function post(body) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  if (data.status !== "ok") throw new Error(data.message || "endpoint error");
  return data;
}

async function run() {
  let domain = FALLBACK_DOMAIN;
  let products = [];
  try {
    if (ENDPOINT.startsWith("https://")) {
      const cfg = await post({ action: "getConfig", token: TOKEN });
      if (cfg?.config?.seoUrlCanonica) domain = cfg.config.seoUrlCanonica.replace(/\/$/, "");
      const pr = await post({ action: "getProducts", token: TOKEN });
      products = (pr.products || [])
        .map((p) => ({ id: String(p.id || "").trim() }))
        .filter((p) => p.id);
      console.log(`Config + ${products.length} productos desde endpoint.`);
    } else {
      console.log("Sin VITE_APPS_SCRIPT_URL: sitemap mínimo.");
    }
  } catch (e) {
    console.warn("Endpoint no disponible, sitemap mínimo:", e.message);
  }

  const dateStr = new Date().toISOString().split("T")[0];
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  xml += `   <url>\n      <loc>${domain}/</loc>\n      <lastmod>${dateStr}</lastmod>\n      <changefreq>daily</changefreq>\n      <priority>1.0</priority>\n   </url>\n`;
  for (const p of products.slice(0, 5000)) {
    xml += `   <url>\n      <loc>${domain}/?p=${encodeURIComponent(p.id)}</loc>\n      <lastmod>${dateStr}</lastmod>\n      <changefreq>weekly</changefreq>\n      <priority>0.6</priority>\n   </url>\n`;
  }
  xml += "</urlset>\n";

  const publicDir = path.join(process.cwd(), "public");
  fs.writeFileSync(path.join(publicDir, "sitemap.xml"), xml, "utf8");
  fs.writeFileSync(
    path.join(publicDir, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${domain}/sitemap.xml\n`,
    "utf8"
  );
  console.log("sitemap.xml + robots.txt generados.");
}

run();
