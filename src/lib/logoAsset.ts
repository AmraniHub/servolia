import fs from "fs";
import path from "path";

/** Base64 data URI for the "S" mark — read once at build time. */
export function iconMarkDataUri(): string {
  const file = fs.readFileSync(path.join(process.cwd(), "public", "logo-icon.png"));
  return `data:image/png;base64,${file.toString("base64")}`;
}
