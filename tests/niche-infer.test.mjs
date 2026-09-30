/**
 * A plan buyer's intake names no niche. Their draft must still get the niche
 * template (pages, FAQs, photos), and no photo-less block may render as an
 * empty photo box.
 *   node --import ./tests/register.mjs --test tests/niche-infer.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inferNiche } from "../src/lib/niches/infer.ts";
import { isDentalNiche } from "../src/lib/niches/dental.ts";
import { isAestheticNiche } from "../src/lib/niches/aesthetic.ts";
import { isHomeServicesNiche } from "../src/lib/niches/homeServices.ts";

test("the business name decides, in French and English", () => {
  assert.equal(inferNiche("Cabinet Dentaire Walk S1 (TEST)"), "dental");
  assert.equal(inferNiche("Dr Martin, chirurgien-dentiste"), "dental");
  assert.equal(inferNiche("Smile Orthodontics"), "dental");
  assert.equal(inferNiche("Clinique Esthétique Lumière"), "aesthetic");
  assert.equal(inferNiche("Glow Med Spa"), "aesthetic");
  assert.equal(inferNiche("Dupont Plomberie"), "home-services");
  assert.equal(inferNiche("Martin Électricien"), "home-services");
});

test("the services decide only when the name says nothing", () => {
  assert.equal(inferNiche("Cabinet Martin", "Détartrage, soins dentaires, orthodontie"), "dental");
  assert.equal(inferNiche("Maison Laurent", "Chauffage, climatisation"), "home-services");
  // The name wins over a service that mentions another trade.
  assert.equal(inferNiche("Clinique Esthétique Rose", "Blanchiment dentaire, botox"), "aesthetic");
});

test("loose words that would misfire on free text do not", () => {
  assert.equal(inferNiche("Artisan Boulanger"), null, "an artisan bakery is not a plumber");
  assert.equal(inferNiche("Hair Studio", "Implants capillaires"), null, "hair implants are not dentistry");
  assert.equal(inferNiche("Cabinet d'avocats", "Droit des affaires"), null);
  assert.equal(inferNiche(null, null), null);
});

test("every inferred niche is one the templates recognise", () => {
  assert.ok(isDentalNiche(inferNiche("Cabinet Dentaire")));
  assert.ok(isAestheticNiche(inferNiche("Clinique Esthétique")));
  assert.ok(isHomeServicesNiche(inferNiche("Plomberie Dupont")));
});

test("configFromIntake uses it when the build names no niche", () => {
  const src = readFileSync(new URL("../src/lib/clientSites.ts", import.meta.url), "utf8");
  assert.match(src, /str\(src\.niche\) \?\? str\(d\.niche\)\s*\?\? inferNiche\(businessName,/);
});

test("a block with no photo is a numbered card, never an empty photo box", () => {
  const src = readFileSync(new URL("../src/components/ClientSite.tsx", import.meta.url), "utf8");
  const row = src.slice(src.indexOf("function FeatureRow"), src.indexOf("export default function ClientSite"));
  // The 4:3 photo frame is only drawn inside the photo branch.
  assert.equal((row.match(/aspect-\[4\/3\]/g) ?? []).length, 1);
  assert.match(row, /\{photo \? \(\s*<div className=\{`relative rounded-\[32px\] overflow-hidden aspect-\[4\/3\]/);
  assert.match(row, /String\(n\)\.padStart\(2, "0"\)/);
});
