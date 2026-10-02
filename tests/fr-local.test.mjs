import test from "node:test";
import assert from "node:assert/strict";

const { FR_LOCAL } = await import("../src/lib/content/frLocal.ts");
const { FR_CITY_SLUGS, FR_GEO_NICHE_SLUGS } = await import("../src/lib/content/frGeo.ts");

const blocks = Object.entries(FR_LOCAL).flatMap(([niche, cities]) =>
  Object.entries(cities).map(([city, b]) => ({ niche, city, b })));

test("local blocks only exist for real niche x city pages", () => {
  for (const { niche, city } of blocks) {
    assert.ok(FR_GEO_NICHE_SLUGS.includes(niche), `unknown niche ${niche}`);
    assert.ok(FR_CITY_SLUGS.includes(city), `unknown city ${city}`);
  }
});

test("every figure is sourced and dated, every block is substantial", () => {
  for (const { niche, city, b } of blocks) {
    const where = `${niche}/${city}`;
    assert.ok(b.sources.length >= 1, `${where}: no source`);
    for (const s of b.sources) assert.match(s.url, /^https:\/\//, `${where}: source URL ${s.url}`);
    for (const s of b.stats) assert.match(s.note, /(19|20)\d\d/, `${where}: stat "${s.label}" has no year in its note`);
    assert.ok(b.paragraphs.length >= 2, `${where}: needs at least two paragraphs`);
    const words = [b.heading, ...b.paragraphs, b.faq?.q ?? "", b.faq?.a ?? ""].join(" ").split(/\s+/).length;
    assert.ok(words >= 150, `${where}: only ${words} words of local content`);
  }
});

test("no two cities share a paragraph (the point is that each page differs)", () => {
  const seen = new Map();
  for (const { niche, city, b } of blocks) {
    for (const p of b.paragraphs) {
      const key = `${niche}|${p}`;
      assert.ok(!seen.has(key), `${niche}/${city} repeats a paragraph from ${seen.get(key)}`);
      seen.set(key, city);
    }
  }
});
