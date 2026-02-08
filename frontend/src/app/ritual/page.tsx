"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useCompanionStore } from "@/lib/store";
import { createCompanion } from "@/lib/api";

type Phase = "void" | "input" | "flash" | "done";

const RELATIONSHIP_OPTIONS = [
  { value: "lover", label: "Lover" },
  { value: "friend", label: "Best Friend" },
  { value: "mentor", label: "Mentor" },
  { value: "sibling", label: "Sibling" },
];

const TONE_OPTIONS = [
  { value: "warm and caring", label: "Warm" },
  { value: "playful and witty", label: "Playful" },
  { value: "calm and wise", label: "Calm" },
  { value: "bold and honest", label: "Bold" },
];

export default function RitualPage() {
  const router = useRouter();
  const setCompanion = useCompanionStore((s) => s.setCompanion);

  const [phase, setPhase] = useState<Phase>("void");
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("friend");
  const [tone, setTone] = useState("warm and caring");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Start the ritual after the void
  const beginRitual = () => setPhase("input");

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Generate a temp user_id (in production this comes from auth)
      const userId = crypto.randomUUID();

      const companion = await createCompanion({
        user_id: userId,
        name: name.trim(),
        relationship_type: relationship,
        tone_style: tone,
      });

      setCompanion(companion.companion_id, companion.name, userId);

      // Flash phase
      setPhase("flash");
      setTimeout(() => {
        setPhase("done");
        router.push("/chat");
      }, 1600);
    } catch (err) {
      console.error("Failed to create companion:", err);
      setIsSubmitting(false);
    }
  }, [name, relationship, tone, isSubmitting, setCompanion, router]);

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-black overflow-hidden">
      <AnimatePresence mode="wait">
        {/* ── PHASE: VOID ── */}
        {phase === "void" && (
          <motion.div
            key="void"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="flex flex-col items-center gap-8 cursor-pointer"
            onClick={beginRitual}
          >
            {/* Breathing dot */}
            <motion.div
              className="w-3 h-3 rounded-full bg-accent"
              animate={{
                boxShadow: [
                  "0 0 8px 2px rgba(168,130,255,0.2)",
                  "0 0 30px 10px rgba(168,130,255,0.5)",
                  "0 0 8px 2px rgba(168,130,255,0.2)",
                ],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.p
              className="text-white/20 text-xs tracking-[0.3em] uppercase"
              animate={{ opacity: [0.2, 0.6, 0.2] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              Touch to begin
            </motion.p>
          </motion.div>
        )}

        {/* ── PHASE: INPUT ── */}
        {phase === "input" && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col items-center gap-10 px-6 max-w-md w-full"
          >
            {/* Title */}
            <div className="text-center space-y-3">
              <motion.h1
                className="font-serif text-3xl md:text-4xl text-white/90 tracking-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
              >
                Name your companion
              </motion.h1>
              <motion.p
                className="text-sm text-white/30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.6 }}
              >
                Choose a name, and begin the bond.
              </motion.p>
            </div>

            {/* Name input */}
            <motion.div
              className="w-full"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Their name..."
                maxLength={50}
                autoFocus
                className="w-full text-center text-2xl font-serif bg-transparent border-b border-white/10 focus:border-accent/50 pb-3 outline-none text-white/90 placeholder-white/15 transition-colors"
              />
            </motion.div>

            {/* Relationship */}
            <motion.div
              className="w-full space-y-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.6 }}
            >
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/25 text-center">
                Relationship
              </p>
              <div className="flex justify-center gap-2 flex-wrap">
                {RELATIONSHIP_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setRelationship(opt.value)}
                    className={`px-4 py-2 rounded-full text-xs transition-all ${
                      relationship === opt.value
                        ? "bg-accent/20 text-accent border border-accent/30"
                        : "bg-white/[0.03] text-white/40 border border-white/[0.06] hover:border-white/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Tone */}
            <motion.div
              className="w-full space-y-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.6 }}
            >
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/25 text-center">
                Personality
              </p>
              <div className="flex justify-center gap-2 flex-wrap">
                {TONE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTone(opt.value)}
                    className={`px-4 py-2 rounded-full text-xs transition-all ${
                      tone === opt.value
                        ? "bg-accent/20 text-accent border border-accent/30"
                        : "bg-white/[0.03] text-white/40 border border-white/[0.06] hover:border-white/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Submit */}
            <motion.button
              onClick={handleSubmit}
              disabled={!name.trim() || isSubmitting}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1, duration: 0.6 }}
              className="px-8 py-3 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm tracking-wide hover:bg-accent/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border border-accent/40 border-t-accent rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                "Begin"
              )}
            </motion.button>
          </motion.div>
        )}

        {/* ── PHASE: FLASH ── */}
        {phase === "flash" && (
          <motion.div
            key="flash"
            className="fixed inset-0 flex items-center justify-center bg-black z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Expanding ring */}
            <motion.div
              className="absolute w-4 h-4 rounded-full border border-accent"
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 60, opacity: 0 }}
              transition={{ duration: 1.4, ease: "easeOut" }}
            />
            {/* Center flash */}
            <motion.div
              className="w-2 h-2 rounded-full bg-white"
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            />
            {/* Name reveal */}
            <motion.p
              className="absolute font-serif text-2xl text-white/80"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.8, 1, 1, 1.05] }}
              transition={{ duration: 1.5, times: [0, 0.3, 0.7, 1] }}
            >
              {name}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
