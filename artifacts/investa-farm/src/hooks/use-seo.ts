import { useEffect } from "react";

interface SeoOptions {
  title: string;
  description: string;
  canonicalPath?: string;
  ogImage?: string;
  ogType?: "website" | "article";
  /** ISO date string */
  publishedAt?: string;
  /** ISO date string */
  updatedAt?: string;
  author?: string;
  keywords?: string;
  /** Raw JSON-LD object(s) to inject as a script tag */
  structuredData?: object | object[];
}

const BASE_URL = "https://investafarm.com";
const DEFAULT_IMAGE = `${BASE_URL}/opengraph.jpg`;
const SITE_NAME = "Investa Farm";

export function useSeo(opts: SeoOptions) {
  useEffect(() => {
    const prev = {
      title: document.title,
    };

    // Title
    document.title = `${opts.title} | ${SITE_NAME}`;

    const set = (name: string, value: string, attr = "name") => {
      let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
      let created = false;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
        created = true;
      }
      el.setAttribute("content", value);
      return created;
    };

    const canonical = opts.canonicalPath
      ? `${BASE_URL}${opts.canonicalPath}`
      : null;

    // Standard meta
    set("description", opts.description);
    if (opts.keywords) set("keywords", opts.keywords);
    if (opts.author) set("author", opts.author);

    // Canonical
    let canonicalEl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) {
      if (!canonicalEl) {
        canonicalEl = document.createElement("link");
        canonicalEl.rel = "canonical";
        document.head.appendChild(canonicalEl);
      }
      canonicalEl.href = canonical;
    }

    // Open Graph
    set("og:title", opts.title, "property");
    set("og:description", opts.description, "property");
    set("og:type", opts.ogType ?? "website", "property");
    set("og:image", opts.ogImage ?? DEFAULT_IMAGE, "property");
    if (canonical) set("og:url", canonical, "property");
    if (opts.publishedAt) set("article:published_time", opts.publishedAt, "property");
    if (opts.updatedAt) set("article:modified_time", opts.updatedAt, "property");
    if (opts.author) set("article:author", opts.author, "property");

    // Twitter
    set("twitter:title", opts.title);
    set("twitter:description", opts.description);
    set("twitter:image", opts.ogImage ?? DEFAULT_IMAGE);

    // Structured data
    let sdEl: HTMLScriptElement | null = document.getElementById("__page_ld_json") as HTMLScriptElement | null;
    if (opts.structuredData) {
      if (!sdEl) {
        sdEl = document.createElement("script");
        sdEl.type = "application/ld+json";
        sdEl.id = "__page_ld_json";
        document.head.appendChild(sdEl);
      }
      const data = Array.isArray(opts.structuredData)
        ? opts.structuredData
        : [opts.structuredData];
      sdEl.textContent = JSON.stringify(data.length === 1 ? data[0] : data);
    }

    return () => {
      document.title = prev.title;
      if (sdEl) sdEl.remove();
    };
  }, [
    opts.title,
    opts.description,
    opts.canonicalPath,
    opts.ogImage,
    opts.ogType,
    opts.publishedAt,
    opts.updatedAt,
    opts.author,
    opts.keywords,
    opts.structuredData,
  ]);
}
