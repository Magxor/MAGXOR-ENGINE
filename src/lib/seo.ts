import type { MxConfig } from "./api";

function setMeta(selector: string, attr: string, value: string, createTag = "meta") {
  let el = document.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
  if (!el) {
    el = document.createElement(createTag) as HTMLMetaElement;
    document.head.appendChild(el);
  }
  el.setAttribute(attr.includes("property") ? "property" : attr.split("=")[0], value);
  void selector;
}

function upsertMetaName(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertMetaProperty(prop: string, content: string) {
  let el = document.querySelector(`meta[property="${prop}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", prop);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function applyStoreSeo(cfg: MxConfig, extraKeywords: string[] = []) {
  const title = cfg.seoTitulo || `${cfg.nombreWeb} — Tienda online`;
  const desc = cfg.seoDescripcion || `Catálogo online de ${cfg.nombreWeb}.`;
  const kws = [cfg.seoKeywords, ...extraKeywords].filter(Boolean).join(", ");
  const logo = cfg.logoUrl || cfg.faviconUrl || "/logo.png";
  const canonical = cfg.seoUrlCanonica || window.location.origin + "/";

  document.title = title;
  upsertMetaName("description", desc);
  if (kws) upsertMetaName("keywords", kws);
  upsertMetaName("robots", cfg.seoRobots || "index, follow");
  upsertLink("canonical", canonical);
  upsertMetaProperty("og:type", "website");
  upsertMetaProperty("og:title", title);
  upsertMetaProperty("og:description", desc);
  upsertMetaProperty("og:image", logo);
  upsertMetaProperty("og:url", canonical);
  upsertMetaName("twitter:card", "summary_large_image");
  upsertMetaName("twitter:title", title);
  upsertMetaName("twitter:description", desc);
  upsertMetaName("twitter:image", logo);
  upsertLink("icon", cfg.faviconUrl || logo);
  upsertLink("apple-touch-icon", logo);

  const ld = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: cfg.nombreWeb,
    description: desc,
    image: logo,
    url: canonical,
    address: { "@type": "PostalAddress", streetAddress: cfg.direccion || "" },
  };
  let script = document.querySelector('script[data-mx="store-ld"]');
  if (!script) {
    script = document.createElement("script");
    script.setAttribute("type", "application/ld+json");
    script.setAttribute("data-mx", "store-ld");
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(ld);
  void setMeta;
}

export function applyProductSeo(name: string, image: string, price: number, cfg: MxConfig) {
  const title = `${name} — ${cfg.nombreWeb}`;
  document.title = title;
  upsertMetaProperty("og:title", title);
  upsertMetaName("twitter:title", title);
  if (image) {
    upsertMetaProperty("og:image", image);
    upsertMetaName("twitter:image", image);
  }
  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    image: image ? [image] : [],
    offers: { "@type": "Offer", price, priceCurrency: cfg.moneda || "ARS", availability: "https://schema.org/InStock" },
  };
  let script = document.querySelector('script[data-mx="product-ld"]');
  if (!script) {
    script = document.createElement("script");
    script.setAttribute("type", "application/ld+json");
    script.setAttribute("data-mx", "product-ld");
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(ld);
}

export function restoreProductSeo(cfg: MxConfig) {
  const s = document.querySelector('script[data-mx="product-ld"]');
  if (s) s.remove();
  applyStoreSeo(cfg);
}
