/**
 * Lets Node run the app's TypeScript modules directly for tests.
 *
 * Node 22 strips types by itself; what it cannot do is resolve the `@/lib/x`
 * alias tsconfig gives the app, or guess the `.ts` extension. This hook does
 * both and nothing else. Register it with:
 *
 *   node --import ./tests/register.mjs --test tests/foo.test.mjs
 */
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

function withExtension(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (existsSync(candidate) && !candidate.endsWith(path.sep)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const hit = withExtension(path.join(SRC, specifier.slice(2)));
    if (hit) return next(pathToFileURL(hit).href, context);
  }
  // A RELATIVE import inside src/ without its extension (`./whatsapp` from
  // email.ts) is the same problem in a different coat: the app's bundler
  // guesses `.ts`, Node will not. Only for files under src/, so a test's own
  // relative imports are left to Node's normal rules.
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith(pathToFileURL(SRC).href)) {
    const from = path.dirname(fileURLToPath(context.parentURL));
    const hit = withExtension(path.resolve(from, specifier));
    if (hit && hit !== path.resolve(from, specifier)) return next(pathToFileURL(hit).href, context);
  }
  // `next/server`, `next/headers`: Next ships these as bare .js files with no
  // exports map, which the app's bundler resolves and Node's ESM loader does
  // not. Lets a test import a route handler as it is written.
  if (/^next\/[a-z-]+$/.test(specifier)) return next(`${specifier}.js`, context);
  return next(specifier, context);
}
