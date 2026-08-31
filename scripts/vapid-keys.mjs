#!/usr/bin/env node
/**
 * Generate the VAPID key pair that Web Push needs — `npm run vapid`
 *
 * You run this, not Claude: the private key is a credential, and the point of
 * generating it in your own terminal is that it never passes through anyone
 * else's hands on the way to Vercel.
 *
 * The pair identifies YOUR server to the browsers' push services. Regenerating
 * it later invalidates every existing subscription silently — clients simply
 * stop receiving notifications, with no error anywhere — so generate once and
 * keep it.
 */

import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

const line = "-".repeat(72);
console.log("");
console.log("  VAPID KEYS — paste these into Vercel, then redeploy");
console.log("  " + line);
console.log("");
console.log("  NEXT_PUBLIC_VAPID_PUBLIC_KEY");
console.log("  " + publicKey);
console.log("");
console.log("  VAPID_PRIVATE_KEY          (Sensitive — never commit or paste in chat)");
console.log("  " + privateKey);
console.log("");
console.log("  VAPID_SUBJECT");
console.log("  mailto:hello@servolia.com");
console.log("");
console.log("  " + line);
console.log("  All three are required. With any one missing, push silently");
console.log("  does nothing and the portal simply never offers it.");
console.log("");
console.log("  Generate ONCE. A new pair invalidates every existing");
console.log("  subscription without warning — clients would just stop being");
console.log("  notified, and nothing would report it.");
console.log("");
