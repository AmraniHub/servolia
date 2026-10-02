/**
 * Local, SOURCED content for the French city pages (/fr/[niche]/[ville]).
 *
 * Why it exists (2026-10-02): Search Console knew 45 of the sitemap's 104
 * pages, and the city pages were 97% identical — Paris and Lyon differed only
 * by the city name, which Google treats as near-duplicates and sets aside.
 * Each block here makes one page genuinely about one city: figures a
 * practitioner can check, a few paragraphs that only make sense there, and one
 * question a local owner would actually ask.
 *
 * THE RULE: every figure carries its source. A local number nobody can verify
 * is worse than none — a dentist in Lyon knows roughly how many confrères she
 * has. Where no official figure exists, the stat is left out, not estimated.
 */

export interface LocalStat {
  /** "Chirurgiens-dentistes" */
  label: string;
  /** "1 234" — already formatted for French readers */
  value: string;
  /** "Rhône (69), 2024" — the scope and year, shown under the value */
  note: string;
}

export interface LocalSource {
  label: string;
  url: string;
}

export interface LocalBlock {
  /** "Le marché dentaire à Lyon" */
  heading: string;
  stats: LocalStat[];
  paragraphs: string[];
  /** A question a local owner would ask; also goes into the FAQPage JSON-LD. */
  faq?: { q: string; a: string };
  sources: LocalSource[];
}

import { FR_LOCAL_DENTAL } from "./frLocalDental";
import { FR_LOCAL_AESTHETIC } from "./frLocalAesthetic";
import { FR_LOCAL_HOME } from "./frLocalHome";

/** niche slug -> city slug -> block. A missing entry falls back to the city hook. */
export const FR_LOCAL: Record<string, Record<string, LocalBlock>> = {
  dentiste: FR_LOCAL_DENTAL,
  "clinique-esthetique": FR_LOCAL_AESTHETIC,
  "services-a-domicile": FR_LOCAL_HOME,
};

export function localBlockFor(niche: string, city: string): LocalBlock | null {
  return FR_LOCAL[niche]?.[city] ?? null;
}
