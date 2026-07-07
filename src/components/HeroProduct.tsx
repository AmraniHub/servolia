"use client";

import { motion } from "framer-motion";
import { Bot, Calendar, TrendingUp, CheckCircle2 } from "lucide-react";

/**
 * HeroProduct — a polished "Servolia OS" dashboard mockup shown in the hero.
 * Tells the whole story at a glance: AI chat → lead captured → pipeline → booked.
 * Pure presentational, no data dependencies.
 */
export default function HeroProduct() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.55 }}
      className="relative mx-auto max-w-4xl"
    >
      {/* Glow behind the card */}
      <div className="absolute -inset-4 bg-[#0CA6E9]/20 rounded-[28px] blur-3xl pointer-events-none" />

      {/* Browser frame */}
      <div className="relative rounded-2xl border border-[#FAFAF7]/15 bg-[#0B1F12]/80 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Chrome bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#FAFAF7]/10">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
            <span className="w-3 h-3 rounded-full bg-[#28C840]" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="px-4 py-1 rounded-md bg-[#FAFAF7]/8 text-[#FAFAF7]/50 text-[11px] font-medium">
              app.servolia.com/pipeline
            </div>
          </div>
        </div>

        {/* Body: two panels */}
        <div className="grid md:grid-cols-[1.3fr_1fr]">
          {/* LEFT — Live pipeline */}
          <div className="p-5 border-b md:border-b-0 md:border-r border-[#FAFAF7]/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#0CA6E9]" />
                <span className="text-[#FAFAF7] text-sm font-bold">Live Pipeline</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#0CA6E9]/15 border border-[#0CA6E9]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0CA6E9] animate-pulse-dot" />
                <span className="text-[#ABDF90] text-[10px] font-bold">€48,200 open</span>
              </div>
            </div>

            <div className="space-y-2">
              {[
                { name: "Dr. Laurent — Dental", niche: "Implant consult", score: 92, value: "€4,500", color: "#0CA6E9" },
                { name: "Élodie Spa — Aesthetic", niche: "Botox enquiry", score: 78, value: "€1,200", color: "#0CA6E9" },
                { name: "Maison Royale — Realty", niche: "Villa mandate", score: 64, value: "€18,000", color: "#FEBC2E" },
                { name: "ClimaTech — HVAC", niche: "Install quote", score: 51, value: "€3,300", color: "#FEBC2E" },
              ].map((lead, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.9 + i * 0.12 }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#FAFAF7]/[0.04] border border-[#FAFAF7]/[0.06] hover:bg-[#FAFAF7]/[0.07] transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#36671E] flex items-center justify-center text-[#ABDF90] text-xs font-black shrink-0">
                    {lead.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[#FAFAF7] text-xs font-semibold truncate">{lead.name}</p>
                    <p className="text-[#FAFAF7]/40 text-[10px] truncate">{lead.niche}</p>
                  </div>
                  <span
                    className="text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0"
                    style={{ background: `${lead.color}22`, color: lead.color }}
                  >
                    {lead.score}
                  </span>
                  <span className="text-[#FAFAF7]/70 text-[11px] font-bold shrink-0 w-14 text-right">{lead.value}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* RIGHT — AI chat + booking */}
          <div className="p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-[#0CA6E9] flex items-center justify-center">
                <Bot className="w-4 h-4 text-[#091C20]" />
              </div>
              <div>
                <p className="text-[#FAFAF7] text-xs font-bold leading-none">AI Receptionist</p>
                <p className="text-[#0CA6E9] text-[10px] font-semibold mt-0.5">● online · replies instantly</p>
              </div>
            </div>

            <div className="space-y-2.5 flex-1">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
                className="ml-auto max-w-[85%] px-3 py-2 rounded-2xl rounded-br-sm bg-[#0CA6E9] text-[#091C20] text-[11px] font-medium leading-snug"
              >
                Hi, do you do implants? I&apos;m free Thursday.
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5 }}
                className="mr-auto max-w-[88%] px-3 py-2 rounded-2xl rounded-bl-sm bg-[#FAFAF7]/8 text-[#FAFAF7]/90 text-[11px] leading-snug"
              >
                Yes! Dr. Laurent has Thursday 14:30 open for an implant consult. Shall I book it for you?
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.9 }}
                className="ml-auto max-w-[60%] px-3 py-2 rounded-2xl rounded-br-sm bg-[#0CA6E9] text-[#091C20] text-[11px] font-medium leading-snug"
              >
                Yes please 🙌
              </motion.div>
            </div>

            {/* Booking confirmed card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 2.3, ease: [0.22, 1, 0.36, 1] }}
              className="mt-3 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#0CA6E9]/15 border border-[#0CA6E9]/30"
            >
              <CheckCircle2 className="w-4 h-4 text-[#0CA6E9] shrink-0" />
              <div className="min-w-0">
                <p className="text-[#FAFAF7] text-[11px] font-bold leading-none">Appointment booked</p>
                <p className="text-[#ABDF90] text-[10px] mt-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Thu 14:30 · added to CRM
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
