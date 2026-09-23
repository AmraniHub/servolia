"use client";

import dynamic from "next/dynamic";

/* The root 404 is part of every page's layout tree, so whatever it imports
   is bundled with every page — a practice's own site at her domain included.
   Loaded on demand, Servolia's Navbar and Footer reach a browser only when a
   404 is actually shown (C2 review, 2026-09-22). */
const NotFoundView = dynamic(() => import("@/components/NotFoundView"));

export default function NotFoundLazy() {
  return <NotFoundView />;
}
