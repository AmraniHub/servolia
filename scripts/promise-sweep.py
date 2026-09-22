# -*- coding: utf-8 -*-
"""
Replace every promise the code does not keep with the one it does.

One-shot, exact-string, byte-preserving. Each replacement must be found
EXACTLY once or the script stops before writing anything -- a promise that
moved is a promise nobody re-read. Run from the repo root with the real
Python (the bare `python` on this machine is a Store stub):

  C:/Users/Elamr/AppData/Local/Programs/Python/Python313/python.exe scripts/promise-sweep.py

Why a script and not hand edits: 40 lines across 16 files, every one
carrying an accent or an arrow that a shell would mangle. Written 2026-09-22.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# What is TRUE today:
#  - the free audit is scored on screen in ~20 seconds (/api/audit); a person
#    replies within one working day (the SLA on /admin/today);
#  - the first draft arrives by email minutes after the intake;
#  - progress comes by email; nobody records Looms;
#  - going live happens when the client says go -- no hour promised.
EN_AUDIT = "your scored audit appears on screen in about 20 seconds, and we reply personally within one working day"
FR_AUDIT = "votre audit chiffré s'affiche à l'écran en 20 secondes environ, et nous vous répondons personnellement sous un jour ouvré"

R = [
  # about
  ("src/app/about/page.tsx",
   "We record a 5-minute Loom of your current online presence — what's working, what's costing you clients, and what we'd fix. No commitment, no call required.",
   "Your site is scored on screen in about 20 seconds — what's working, what's costing you clients, and what we'd fix — and we reply personally within one working day. No commitment, no call required."),
  ("src/app/about/page.tsx",
   "Weekly progress updates. Same-day responses to email. Loom walkthroughs at every milestone.",
   "Progress by email at every step. Same-day responses. Your first draft in your inbox minutes after your intake."),
  ("src/app/about/page.tsx",
   "Request a free audit. We record a 5-minute Loom showing exactly what we&apos;d fix on your current site to start bringing in more clients. No call, no credit card.",
   "Request a free audit. Your site is scored on screen in about 20 seconds, showing exactly what we&apos;d fix to start bringing in more clients. No call, no credit card."),
  # case studies
  ("src/app/case-studies/page.tsx",
   "Start with a free audit. We record a 5-minute Loom video of your current online presence and show you exactly what to fix — no charge, no commitment.",
   "Start with a free audit. Your site is scored on screen in about 20 seconds and we show you exactly what to fix — no charge, no commitment."),
  ("src/app/case-studies/page.tsx",
   "Audit delivered within 24h · No call required · No credit card",
   "Scored in 20 seconds · Personal reply within one working day · No credit card"),
  ("src/app/fr/cas-clients/page.tsx",
   "Audit livré sous 24h · Sans appel · Sans carte bancaire",
   "Audit chiffré en 20 secondes · Réponse personnelle sous un jour ouvré · Sans carte bancaire"),
  # contact
  ("src/app/contact/page.tsx",
   "We'll analyze your online presence and send you a PDF report showing exactly what's costing you clients — within 24 hours.",
   "We read every message and reply personally within one working day — and if you want the numbers first, the free audit scores your site on screen in about 20 seconds."),
  ("src/app/contact/page.tsx",
   'desc: "Within 24 hours we send a PDF audit showing your gaps and our recommendations."',
   'desc: "We reply personally within one working day, with what we would fix and why."'),
  ("src/app/contact/page.tsx",
   "Your free audit is being prepared. You'll receive a detailed PDF report at <strong>{form.email}</strong> within 24 hours.",
   "Thank you — we read every message. You'll hear from us personally at <strong>{form.email}</strong> within one working day."),
  ("src/app/contact/page.tsx",
   "PDF audit sent within 24h",
   "Personal reply within one working day"),
  ("src/app/fr/contact/page.tsx",
   "Nous analysons votre présence en ligne et vous envoyons un rapport montrant exactement ce qui vous coûte des clients — sous 24 heures.",
   "Nous lisons chaque message et vous répondons personnellement sous un jour ouvré — et si vous voulez les chiffres d'abord, l'audit gratuit note votre site à l'écran en 20 secondes environ."),
  ("src/app/fr/contact/page.tsx",
   'desc: "Sous 24 heures, nous envoyons un audit montrant vos points faibles et nos recommandations."',
   'desc: "Nous vous répondons personnellement sous un jour ouvré, avec ce que nous corrigerions et pourquoi."'),
  ("src/app/fr/contact/page.tsx",
   "Votre audit gratuit est en préparation. Vous recevrez un rapport détaillé à <strong>{form.email}</strong> sous 24 heures.",
   "Merci — nous lisons chaque message. Vous aurez une réponse personnelle à <strong>{form.email}</strong> sous un jour ouvré."),
  ("src/app/fr/contact/page.tsx",
   "Audit envoyé sous 24h",
   "Réponse personnelle sous un jour ouvré"),
  # fr audit page
  ("src/app/fr/audit/page.tsx",
   "Recevez sous 24h un audit gratuit de votre site, de votre parcours de réservation et de votre acquisition de clients. Sans engagement, sans appel commercial.",
   "Un audit gratuit de votre site, de votre parcours de réservation et de votre acquisition de clients — noté à l'écran en 20 secondes, puis une réponse personnelle sous un jour ouvré. Sans engagement, sans appel commercial."),
  # fr how it works
  ("src/app/fr/comment-ca-marche/page.tsx",
   'title: "Vous recevez votre audit vidéo sous 24h",',
   'title: "Votre audit s\'affiche en 20 secondes",'),
  ("src/app/fr/comment-ca-marche/page.tsx",
   'time: "Sous 24 heures",',
   'time: "Tout de suite",'),
  ("src/app/fr/comment-ca-marche/page.tsx",
   "Une fois la maquette validée, vous donnez le feu vert et nous mettons en ligne sous 24 heures. Il n'y a plus rien à régler — la mise en place est déjà payée.",
   "Une fois la maquette validée, vous donnez le feu vert et nous la mettons en ligne. Il n'y a plus rien à régler — la mise en place est déjà payée."),
  ("src/app/fr/comment-ca-marche/page.tsx",
   "Sans appel · Vidéo envoyée sous 24h · Sans carte bancaire",
   "Sans appel · Audit en 20 secondes · Sans carte bancaire"),
  # fr tarifs
  ("src/app/fr/tarifs/page.tsx",
   'desc: "Remplissez un formulaire de 5 questions. Vous recevez un audit PDF sous 24 h."',
   'desc: "Remplissez un formulaire de 5 questions. Votre audit chiffré s\'affiche en 20 secondes ; nous répondons sous un jour ouvré."'),
  ("src/app/fr/tarifs/page.tsx",
   'desc: "7 jours de production. Vous recevez une vidéo Loom à chaque étape."',
   'desc: "7 jours de production. Votre première version par email en quelques minutes, puis l\'avancement à chaque étape."'),
  # how it works
  ("src/app/how-it-works/page.tsx",
   'title: "We send your Loom audit within 24h",',
   'title: "Your audit appears in 20 seconds",'),
  ("src/app/how-it-works/page.tsx",
   'title: "Loom walkthrough of your draft",',
   'title: "Your first draft, by email, within minutes",'),
  ("src/app/how-it-works/page.tsx",
   "Once you're happy with the draft, you give the green light and we go live within 24 hours. There is nothing left to pay — the installation is already settled.",
   "Once you're happy with the draft, you give the green light and we take it live. There is nothing left to pay — the installation is already settled."),
  ("src/app/how-it-works/page.tsx",
   "No call required · Loom sent within 24h · No credit card",
   "No call required · Audit in 20 seconds · No credit card"),
  # niches
  ("src/app/niches/aesthetic-clinics/page.tsx",
   "No commitment · Response within 24h · Free",
   "No commitment · Personal reply within one working day · Free"),
  ("src/app/niches/home-services/page.tsx",
   "Get a free audit. We&apos;ll record a 5-minute Loom showing exactly what&apos;s costing you jobs and how we&apos;d fix it.",
   "Get a free audit. Your site is scored on screen in about 20 seconds, showing exactly what&apos;s costing you jobs and how we&apos;d fix it."),
  ("src/app/niches/home-services/page.tsx",
   "Response within 24 hours · No call required",
   "Personal reply within one working day · No call required"),
  # home
  ("src/app/page.tsx",
   'desc: "Fill our 5-question form. We send a PDF audit within 24h showing exactly what\'s costing you clients and what to fix. No payment, no pitch call required."',
   'desc: "Fill our 5-question form. Your audit is scored on screen in about 20 seconds — what\'s costing you clients and what to fix — and we reply personally within one working day. No payment, no pitch call."'),
  ("src/app/page.tsx",
   "We build using our 22-step checklist and send Loom walkthroughs at every milestone.",
   "We build using our 22-step checklist and keep you posted by email at every milestone."),
  ("src/components/FrenchHome.tsx",
   "Nous envoyons un audit sous 24h montrant exactement ce qui vous coûte des clients et quoi corriger.",
   "Votre audit s'affiche à l'écran en 20 secondes — ce qui vous coûte des clients et quoi corriger — et nous répondons personnellement sous un jour ouvré."),
  # pricing steps
  ("src/app/pricing/page.tsx",
   'desc: "Fill a 5-question form. We send a PDF audit within 24h."',
   'desc: "Fill a 5-question form. Your audit is scored on screen in 20 seconds; we reply within one working day."'),
  ("src/app/pricing/page.tsx",
   '{ num: "02", title: "Approve scope", desc: "We write the full scope in writing. You review and sign off." }',
   '{ num: "02", title: "Scope in writing", desc: "Your full scope is written down and waiting in your portal before we build a thing." }'),
  ("src/app/pricing/page.tsx",
   'desc: "7-day build. You get Loom walkthroughs at every step."',
   'desc: "7-day build. Your first draft by email within minutes, then progress at every step."'),
  # audit form
  ("src/components/AuditForm.tsx",
   "and send you exactly what's costing you patients, within 24 hours.",
   "and show you exactly what's costing you patients — scored on screen in about 20 seconds."),
  ("src/components/AuditForm.tsx",
   'a: "The form: under 2 minutes. The audit: delivered within 24 hours."',
   'a: "The form: under 2 minutes. The audit: on screen in about 20 seconds. A personal reply within one working day."'),
  ("src/components/AuditForm.tsx",
   'footnote: "Audit within 24 hours. No calls, no spam. GDPR compliant."',
   'footnote: "Scored in 20 seconds. No calls, no spam. GDPR compliant."'),
  ("src/components/AuditForm.tsx",
   "et on vous envoie, sous 24h, exactement ce qui vous coûte des patients",
   "et on vous montre exactement ce qui vous coûte des patients — noté à l'écran en 20 secondes environ"),
  ("src/components/AuditForm.tsx",
   'a: "Le formulaire : moins de 2 minutes. L\'audit : livré sous 24 heures."',
   'a: "Le formulaire : moins de 2 minutes. L\'audit : à l\'écran en 20 secondes environ. Une réponse personnelle sous un jour ouvré."'),
  ("src/components/AuditForm.tsx",
   'footnote: "Audit sous 24 heures. Pas d\'appels, pas de spam. Conforme RGPD."',
   'footnote: "Noté en 20 secondes. Pas d\'appels, pas de spam. Conforme RGPD."'),
  ("src/components/AuditForm.tsx",
   'successBody: "We\'ll review your site and send your free audit within",',
   'successBody: "Your scored audit is on screen above. A person reads your request and replies within",'),
  ("src/components/AuditForm.tsx",
   'successHours: "24 hours",',
   'successHours: "one working day",'),
  ("src/components/AuditForm.tsx",
   'successBody: "Nous analysons votre site et vous envoyons votre audit gratuit sous",',
   'successBody: "Votre audit chiffré est à l\'écran ci-dessus. Une personne lit votre demande et vous répond sous",'),
  ("src/components/AuditForm.tsx",
   'successHours: "24 heures",',
   'successHours: "un jour ouvré",'),
  # marketing page footnote
  ("src/components/MarketingPage.tsx",
   'footNote: "Delivered within 24h · No call required · Fixed price in writing"',
   'footNote: "Scored in 20 seconds · No call required · Fixed price in writing"'),
  ("src/components/MarketingPage.tsx",
   'footNote: "Livré sous 24 h · Sans appel obligatoire · Prix fixe par écrit"',
   'footNote: "Noté en 20 secondes · Sans appel obligatoire · Prix fixe par écrit"'),
  # onboarding thank-you (post-Step-1 copy)
  ("src/components/OnboardingForm.tsx",
   '["After approval", "We go live within 24h — nothing more to pay"]',
   '["After approval", "You say go, we take it live — nothing more to pay"]'),
  ("src/components/OnboardingForm.tsx",
   '["Après validation", "Mise en ligne sous 24 h — plus rien à régler"]',
   '["Après validation", "Vous dites go, nous mettons en ligne — plus rien à régler"]'),
  # receipt (email.ts) - the 24h go-live and the 48h leads
  ("src/lib/email.ts",
   "Vous nous dites quoi changer ; votre validation → mise en ligne sous 24h",
   "Vous nous dites quoi changer ; vous dites go, nous mettons en ligne"),
  ("src/lib/email.ts",
   "You tell us what to change; your approval → we go live within 24 hours",
   "You tell us what to change; you say go, we take it live"),
  ("src/lib/email.ts",
   "<li>Les premières demandes arrivent en général sous 48 h</li>",
   "<li>Chaque demande qui arrive vous est signalée aussitôt, et apparaît dans votre espace</li>"),
  ("src/lib/email.ts",
   "<li>First leads usually arrive within 48 hours</li>",
   "<li>Every enquiry that lands is flagged to you at once, and appears in your portal</li>"),
]

def main() -> int:
    # Group by file and apply CUMULATIVELY on the current text, writing once.
    # The first version of this script re-read each file's original bytes for
    # every replacement, so a file with three entries kept only the last one
    # while the script reported all three done. Each entry must be found
    # exactly once, or already be applied (new present, old absent) — anything
    # else stops the run before a byte is written.
    by_file: dict = {}
    for rel, old, new in R:
        by_file.setdefault(rel, []).append((old, new))
    writes = []
    done = skipped = 0
    for rel, pairs in by_file.items():
        p = ROOT / rel
        text = p.read_bytes().decode("utf-8")
        original = text
        for old, new in pairs:
            n = text.count(old)
            if n == 1:
                text = text.replace(old, new)
                done += 1
            elif n == 0 and new in text:
                skipped += 1  # already applied by an earlier run
            else:
                print(f"STOP: {rel}: expected exactly 1 match, found {n}:\n   {old[:90]}")
                return 1
        if text != original:
            writes.append((p, text))
    for p, text in writes:
        p.write_bytes(text.encode("utf-8"))  # bytes back: no CRLF flip, no BOM
    print(f"ok: {done} replaced, {skipped} already done, {len(writes)} files written")
    return 0

if __name__ == "__main__":
    sys.exit(main())
