/**
 * The visitor's language choice, and where the same page lives in the other
 * language. Client-only (reads the DOM and localStorage).
 *
 * SEO: nothing here runs for a crawler in a way that changes what it sees.
 * No server redirect, no Accept-Language sniffing on the server. Google keeps
 * crawling both versions through the hreflang tags, which are also the ONE
 * source of the EN/FR page pairs used here: each page already declares its
 * twin as <link rel="alternate" hreflang="fr-FR" | "en-US">, so there is no
 * second list to drift out of date.
 */

export type Lang = "en" | "fr";

const KEY = "servolia-lang";

export function getLangPref(): Lang | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "en" || v === "fr" ? v : null;
  } catch {
    return null; // private mode / storage blocked: behave as a first visit
  }
}

export function setLangPref(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* not remembered; the choice still applies to this click */
  }
}

/* Pages that serve French at the same path with ?lang=fr (no /fr/ twin and no
   hreflang pair of their own). */
const QUERY_LANG_PAGES = ["/hosting", "/assistant"];

/** Path of this page's twin in `lang`, from its hreflang tag; null if none. */
export function alternatePath(lang: Lang): string | null {
  if (typeof document === "undefined") return null;
  const herePath = window.location.pathname || "/";
  if (QUERY_LANG_PAGES.includes(herePath)) {
    const isFr = new URLSearchParams(window.location.search).get("lang") === "fr";
    if (lang === "fr") return isFr ? null : `${herePath}?lang=fr`;
    return isFr ? herePath : null;
  }
  const code = lang === "fr" ? "fr-FR" : "en-US";
  const el = document.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${code}"]`);
  const href = el?.getAttribute("href");
  if (!href) return null;
  let path: string;
  try {
    const u = new URL(href, window.location.origin);
    if (u.origin !== window.location.origin && u.hostname !== "servolia.com") return null;
    path = u.pathname || "/";
  } catch {
    return null;
  }
  const here = window.location.pathname || "/";
  if (path === here) return null;
  /* Pages with no twin of their own inherit the root layout's pair
     (/ <-> /fr). That is a fallback for Google, not a real translation of
     the page, so it is not offered — except on the home pages themselves. */
  if (lang === "fr" && path === "/fr" && here !== "/") return null;
  if (lang === "en" && path === "/" && here !== "/fr") return null;
  return path;
}

/** True when the browser's first language is French. */
export function browserPrefersFrench(): boolean {
  if (typeof navigator === "undefined") return false;
  const first = (navigator.languages && navigator.languages[0]) || navigator.language || "";
  return first.toLowerCase().startsWith("fr");
}
