import { supabaseAdmin } from "@/lib/supabase";
import { formatSlot } from "@/lib/booking";
import { Phone, Mail, Building2, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";

interface BookingRow {
  id: string; name: string; email: string; phone: string | null;
  business: string | null; message: string | null;
  slot_start: string; status: string; created_at: string;
}

export default async function BookingsPage() {
  const db = supabaseAdmin();
  let bookings: BookingRow[] = [];
  if (db) {
    const { data } = await db
      .from("bookings")
      .select("*")
      .order("slot_start", { ascending: true });
    bookings = (data as BookingRow[]) ?? [];
  }

  const now = Date.now();
  const upcoming = bookings.filter((b) => new Date(b.slot_start).getTime() >= now && b.status !== "cancelled");
  const past = bookings.filter((b) => new Date(b.slot_start).getTime() < now || b.status === "cancelled");

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-black text-[#18181B] mb-1 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-[#36671E]" /> Discovery calls
      </h1>
      <p className="text-sm text-[#71717A] mb-6">Booked from /call. Each also creates a qualified lead in your pipeline.</p>

      <Section title={`Upcoming (${upcoming.length})`} rows={upcoming} highlight />
      <Section title={`Past (${past.length})`} rows={past} />
    </div>
  );
}

function Section({ title, rows, highlight }: { title: string; rows: BookingRow[]; highlight?: boolean }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-black text-[#52525B] uppercase tracking-widest mb-3">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-[#A1A1AA] bg-white border border-[#E8E6E0] rounded-2xl p-6 text-center">Nothing here yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((b) => (
            <div key={b.id} className={`bg-white border rounded-2xl p-4 ${highlight ? "border-[#36671E]/25" : "border-[#E8E6E0] opacity-80"}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-black text-[#18181B]">{b.name}{b.business ? <span className="text-[#71717A] font-semibold"> · {b.business}</span> : null}</p>
                  <p className="text-sm text-[#36671E] font-bold mt-0.5">{formatSlot(b.slot_start)}</p>
                </div>
                <span className="text-[10px] font-black px-2 py-1 rounded-full bg-[#F5F4EF] text-[#52525B] uppercase">{b.status}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-[#71717A]">
                <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {b.email}</span>
                {b.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {b.phone}</span>}
                {b.business && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {b.business}</span>}
              </div>
              {b.message && <p className="text-sm text-[#3F3F46] mt-2 bg-[#FAFAF7] border-l-2 border-[#36671E] pl-3 py-1.5 rounded-r">{b.message}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
