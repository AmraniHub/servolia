/**
 * THE NUMBER THAT RENEWS HER (C4) — one definition of "what the receptionist
 * did this month", used by the monthly email (1st), the narrative email (5th)
 * and her portal, so the three never disagree.
 *
 * Until 2026-09-23 the 1st counted every qualified chat_sessions row as a
 * "booking request". Rows written by the site's contact form
 * (/api/sites/<slug>/lead, session_id "form_…", qualified: true) were in that
 * count, so a clinic whose receptionist booked nobody could read "Demandes de
 * RDV : 12" — every one of them typed into a form that needs no receptionist.
 * The renewal decision rests on this figure, so it is now split:
 *
 *   receptionistBookings  conversations with the receptionist that became a
 *                         booking request ([BOOKING] in its reply);
 *   formRequests          requests sent through the site's form.
 *
 * The euro line no longer multiplies requests by a treatment value and calls
 * it "value captured" — a request is not a patient. It states what is true:
 * how many new patients cover her plan this month.
 */

export const FORM_SESSION_PREFIX = "form_";

export interface ReportSession {
  session_id?: string | null;
  created_at: string;
  qualified: boolean | null;
  utm?: Record<string, string> | null;
}

export interface ReportMetrics {
  version: 2;
  /** Conversations with the receptionist (form requests excluded). */
  conversations: number;
  /** Those conversations that became a booking request — the headline. */
  receptionistBookings: number;
  /** Requests sent through the site's contact form. */
  formRequests: number;
  /** Receptionist conversations started outside opening hours, in her zone. */
  afterHours: number;
  /** Conversations and form requests that arrived from an ad. */
  fromAds: number;
  /** Her plan's monthly price in EUR, when she has one. */
  planEur: number | null;
  /** EUR per new patient used for the cover line. */
  perClient: number;
  /** Whether perClient came from her own config (true) or the niche default. */
  perClientIsHers: boolean;
  /** New patients that pay for her plan this month; null without a plan. */
  coverNeeded: number | null;
  /** Kept for report rows written before version 2 (portal, admin). */
  enquiries: number;
  bookings: number;
}

const AD_SOURCES = /facebook|instagram|fb|ig|meta|google|adwords|tiktok/i;

/** Fallback EUR per new client when the site config does not set one. */
export const NICHE_VALUE: Record<string, number> = {
  dental: 800, aesthetic: 450, "med-spa": 450, "hair-transplant": 2500,
  "real-estate": 3000, "home-services": 600, "law-firm": 2000,
};

export function isFormRequest(s: Pick<ReportSession, "session_id">): boolean {
  return (s.session_id ?? "").startsWith(FORM_SESSION_PREFIX);
}

/** Typical opening hours, in the client's own zone: Mon–Sat 08:00–19:00.
 *  Default Europe/Paris; a Moroccan client sets Africa/Casablanca. */
export function isAfterHours(at: Date = new Date(), timeZone = "Europe/Paris"): boolean {
  let local: Date;
  try {
    local = new Date(at.toLocaleString("en-US", { timeZone }));
  } catch {
    local = new Date(at.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  }
  const day = local.getDay(); // 0 = Sunday
  const hour = local.getHours();
  return day === 0 || hour < 8 || hour >= 19;
}

export function reportMetrics(
  sessions: ReportSession[],
  opts: { timeZone?: string; planEur?: number | null; avgTreatmentValue?: number | null; niche?: string | null } = {},
): ReportMetrics {
  const chats = sessions.filter((s) => !isFormRequest(s));
  const forms = sessions.filter(isFormRequest);
  const receptionistBookings = chats.filter((s) => s.qualified).length;
  const afterHours = chats.filter((s) => isAfterHours(new Date(s.created_at), opts.timeZone || "Europe/Paris")).length;
  const fromAds = sessions.filter((s) => AD_SOURCES.test(`${s.utm?.utm_source ?? ""} ${s.utm?.utm_medium ?? ""}`)).length;

  const own = typeof opts.avgTreatmentValue === "number" && opts.avgTreatmentValue > 0 ? opts.avgTreatmentValue : null;
  const perClient = own ?? NICHE_VALUE[opts.niche ?? ""] ?? 500;
  const planEur = typeof opts.planEur === "number" && opts.planEur > 0 ? opts.planEur : null;

  return {
    version: 2,
    conversations: chats.length,
    receptionistBookings,
    formRequests: forms.length,
    afterHours,
    fromAds,
    planEur,
    perClient,
    perClientIsHers: own !== null,
    coverNeeded: planEur ? Math.max(1, Math.ceil(planEur / perClient)) : null,
    enquiries: sessions.length,
    bookings: receptionistBookings + forms.length,
  };
}
