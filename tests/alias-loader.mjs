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

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const base = path.join(SRC, specifier.slice(2));
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
      if (existsSync(candidate) && !candidate.endsWith(path.sep)) {
        return next(pathToFileURL(candidate).href, context);
      }
    }
  }
  return next(specifier, context);
}
