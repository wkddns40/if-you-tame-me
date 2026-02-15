"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useCompanionStore } from "@/lib/store";
import { createCompanion } from "@/lib/api";

type Phase = "void" | "input" | "flash" | "done";

const STYLE_OPTIONS = [
  {
    value: "empathetic",
    label: "무조건 내 편 들어줘",
    desc: "공감형",
    icon: "♡",
  },
  {
    value: "analytical",
    label: "냉철한 해결책이 필요해",
    desc: "분석형",
    icon: "◇",
  },
  {
    value: "playful",
    label: "그냥 재밌게 놀래",
    desc: "유희형",
    icon: "✦",
  },
];

export default function RitualPage() {
  const router = useRouter();
  const setCompanion = useCompanionStore((s) => s.setCompanion);
  // TODO: 사진 등록은 관계 형성 후 아이템 구매 시 사용 예정
  // const setBackgroundImage = useCompanionStore((s) => s.setBackgroundImage);

  const [phase, setPhase] = useState<Phase>("void");
  // TODO: 컴패니언 이름은 대화를 통해 자연스럽게 정해질 예정
  // const [name, setName] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tone = selectedStyle || "empathetic";

  // Auto-transition from void to input after 2 seconds
  useEffect(() => {
    if (phase !== "void") return;
    const timer = setTimeout(() => setPhase("input"), 2000);
    return () => clearTimeout(timer);
  }, [phase]);

  // TODO: 사진 등록 관련 함수들 — 관계 형성 후 아이템 구매 시 재활용 예정
  // const readFile = (file: File) => { ... };
  // const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { ... };
  // const handleDrop = (e: React.DragEvent) => { ... };
  // const handleDragOver = (e: React.DragEvent) => { ... };
  // const handleDragLeave = (e: React.DragEvent) => { ... };

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Generate a temp user_id (in production this comes from auth)
      const userId = crypto.randomUUID();

      const companion = await createCompanion({
        user_id: userId,
        name: "???",
        relationship_type: "friend",
        tone_style: tone,
      });

      setCompanion(companion.companion_id, companion.name, userId);

      // TODO: 사진 등록은 관계 형성 후 아이템 구매 시 처리 예정
      // if (wantsPhoto && photoPreview) {
      //   setBackgroundImage(photoPreview);
      // } else {
      //   setBackgroundImage(null);
      // }

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
  }, [tone, isSubmitting, setCompanion, router, selectedStyle]);

  return (
    <div className="relative flex items-center justify-center min-h-screen noise-bg text-white overflow-hidden">

      <AnimatePresence mode="wait">
        {/* ── PHASE: VOID ── */}
        {phase === "void" && (
          <motion.div
            key="void"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="flex flex-col items-center gap-8"
          >
            {/* Soul sphere halo */}
            <div className="w-48 h-48 rounded-full border border-primary/40 flex items-center justify-center relative shadow-[0_0_50px_rgba(230,25,195,0.2)]">
              <div className="absolute inset-0 rounded-full soul-glow scale-150 animate-pulse" />
              <div className="w-4 h-4 rounded-full bg-primary shadow-[0_0_20px_#e619c3]" />
            </div>
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
            className="flex flex-col items-center gap-10 px-8 py-10 max-w-md w-full rounded-3xl glass-morphism z-20"
          >
            {/* Title */}
            <div className="text-center space-y-3">
              <motion.h1
                className="font-serif text-3xl md:text-4xl text-white tracking-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
              >
                Begin the bond
              </motion.h1>
              <motion.p
                className="text-sm text-white/80"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.6 }}
              >
                Choose a conversation style to start.
              </motion.p>
            </div>

            {/* TODO: 컴패니언 이름 입력 — 대화를 통해 자연스럽게 정해질 예정 */}

            {/* Conversation Style */}
            <motion.div
              className="w-full space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.6 }}
            >
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/70 text-center">
                지금 필요한 대화 스타일
              </p>
              <div className="flex flex-col gap-3">
                {STYLE_OPTIONS.map((style) => {
                  const isSelected = selectedStyle === style.value;
                  return (
                    <button
                      key={style.value}
                      type="button"
                      onClick={() => setSelectedStyle(style.value)}
                      className={`relative w-full px-5 py-4 rounded-2xl border text-left transition-all duration-300 ${
                        isSelected
                          ? "bg-accent/10 border-accent/50 shadow-[0_0_20px_rgba(230,25,195,0.15)]"
                          : "bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-lg transition-colors ${
                            isSelected ? "text-accent" : "text-white/70"
                          }`}
                        >
                          {style.icon}
                        </span>
                        <div>
                          <p
                            className={`text-sm tracking-wide transition-colors ${
                              isSelected ? "text-accent" : "text-white/90"
                            }`}
                          >
                            {style.label}
                          </p>
                          <p className="text-[10px] text-white/60 mt-0.5">
                            {style.desc}
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <motion.div
                          layoutId="style-glow"
                          className="absolute inset-0 rounded-2xl border border-accent/30 pointer-events-none"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* Submit */}
            <motion.button
              onClick={handleSubmit}
              disabled={!selectedStyle || isSubmitting}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3, duration: 0.6 }}
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
            className="fixed inset-0 flex items-center justify-center noise-bg z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Expanding ring */}
            <motion.div
              className="absolute w-4 h-4 rounded-full border border-[#e619c3]"
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 60, opacity: 0 }}
              transition={{ duration: 1.4, ease: "easeOut" }}
            />
            {/* Center flash */}
            <motion.div
              className="w-2 h-2 rounded-full bg-[#e619c3] shadow-[0_0_20px_#e619c3]"
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
