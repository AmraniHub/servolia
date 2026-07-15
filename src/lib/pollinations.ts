/**
 * Pollinations.ai — free, keyless image generation via URL.
 * Fetching the URL renders the image; no API key or account needed.
 */

const CATEGORY_STYLE: Record<string, string> = {
  Dental: "modern dental clinic interior, bright and clean, professional photography",
  "Aesthetic Clinics": "modern med spa treatment room, soft light, minimal luxury aesthetic",
  "Real Estate": "modern home exterior at golden hour, architectural photography",
  "Home Services": "professional technician at work, clean modern home, natural light",
  "Law Firms": "modern law office, bookshelves, professional and calm",
  Accounting: "modern office desk with laptop and documents, clean minimal workspace",
  Consulting: "two professionals in a bright meeting room, modern office",
  "AI Systems": "abstract technology visualization, soft green and cream tones, minimal",
  Growth: "upward trending chart on a laptop screen, bright modern office desk, clean minimal",
  Booking: "smartphone showing a calendar booking app, clean desk, soft natural light",
};

export function pollinationsImageUrl(category: string, extra = ""): string {
  const style = CATEGORY_STYLE[category] ?? CATEGORY_STYLE["AI Systems"];
  const prompt = `${style}${extra ? ", " + extra : ""}, high quality, no text, no watermark`;
  const encoded = encodeURIComponent(prompt);
  // Fixed seed-free width/height keeps it web-friendly; nologo removes the Pollinations watermark.
  return `https://image.pollinations.ai/prompt/${encoded}?width=1200&height=630&nologo=true`;
}
