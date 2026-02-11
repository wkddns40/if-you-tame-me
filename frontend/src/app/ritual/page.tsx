"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
  { value: "mother", label: "Mom" },
  { value: "father", label: "Dad" },
  { value: "soulmate", label: "Soulmate" },
];

const TONE_OPTIONS = [
  { value: "INTJ", label: "INTJ" },
  { value: "INTP", label: "INTP" },
  { value: "ENTJ", label: "ENTJ" },
  { value: "ENTP", label: "ENTP" },
  { value: "INFJ", label: "INFJ" },
  { value: "INFP", label: "INFP" },
  { value: "ENFJ", label: "ENFJ" },
  { value: "ENFP", label: "ENFP" },
  { value: "ISTJ", label: "ISTJ" },
  { value: "ISFJ", label: "ISFJ" },
  { value: "ESTJ", label: "ESTJ" },
  { value: "ESFJ", label: "ESFJ" },
  { value: "ISTP", label: "ISTP" },
  { value: "ISFP", label: "ISFP" },
  { value: "ESTP", label: "ESTP" },
  { value: "ESFP", label: "ESFP" },
];

const ITEM_H = 32;
const VISIBLE = 3; // show 3 items (prev, current, next)

function DrumPicker({
  options,
  selectedIndex,
  onSelect,
}: {
  options: { value: string; label: string }[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const accumulated = useRef(0);
  const indexRef = useRef(selectedIndex);
  indexRef.current = selectedIndex;

  const shift = useCallback(
    (dir: number) => {
      onSelect((indexRef.current + dir + options.length) % options.length);
    },
    [onSelect, options.length]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      accumulated.current += e.deltaY;
      if (Math.abs(accumulated.current) >= 40) {
        shift(accumulated.current > 0 ? 1 : -1);
        accumulated.current = 0;
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
      accumulated.current = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const delta = touchStartY.current - e.touches[0].clientY;
      accumulated.current += delta;
      touchStartY.current = e.touches[0].clientY;
      if (Math.abs(accumulated.current) >= 30) {
        shift(accumulated.current > 0 ? 1 : -1);
        accumulated.current = 0;
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [shift]);

  const getItem = (offset: number) => {
    const idx = (selectedIndex + offset + options.length) % options.length;
    return options[idx];
  };

  const offsets = Array.from(
    { length: VISIBLE },
    (_, i) => i - Math.floor(VISIBLE / 2)
  ); // [-1, 0, 1]

  return (
    <div
      ref={containerRef}
      className="relative mx-auto select-none cursor-ns-resize touch-none"
      style={{ width: 160, height: ITEM_H * VISIBLE }}
    >
      {/* fade edges */}
      <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-black/50 to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/50 to-transparent z-10 pointer-events-none" />

      {/* center highlight line */}
      <div
        className="absolute inset-x-4 border-t border-b border-accent/20 pointer-events-none"
        style={{ top: ITEM_H, height: ITEM_H }}
      />

      <AnimatePresence mode="popLayout">
        <motion.div
          key={selectedIndex}
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 flex flex-col"
        >
          {offsets.map((offset) => {
            const item = getItem(offset);
            const isCenter = offset === 0;
            return (
              <div
                key={offset}
                className="flex items-center justify-center"
                style={{ height: ITEM_H }}
              >
                <span
                  className={`text-sm tracking-wide transition-all ${
                    isCenter
                      ? "text-accent scale-110"
                      : "text-white/60 scale-95"
                  }`}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function RitualPage() {
  const router = useRouter();
  const setCompanion = useCompanionStore((s) => s.setCompanion);
  const setBackgroundImage = useCompanionStore((s) => s.setBackgroundImage);
  const setUserName = useCompanionStore((s) => s.setUserName);

  const [phase, setPhase] = useState<Phase>("void");
  const [name, setName] = useState("");
  const [relIndex, setRelIndex] = useState(1); // default: friend
  const [toneIndex, setToneIndex] = useState(0); // default: warm
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wantsPhoto, setWantsPhoto] = useState<boolean | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [nickname, setNickname] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const relationship = RELATIONSHIP_OPTIONS[relIndex].value;
  const tone = TONE_OPTIONS[toneIndex].value;

  // Start the ritual after the void
  const beginRitual = () => setPhase("input");

  const readFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

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

      // Store user nickname
      if (nickname.trim()) {
        setUserName(nickname.trim());
      }

      // Store background image if user uploaded one
      if (wantsPhoto && photoPreview) {
        setBackgroundImage(photoPreview);
      } else {
        setBackgroundImage(null);
      }

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
  }, [name, relationship, tone, isSubmitting, setCompanion, setBackgroundImage, setUserName, router, relIndex, toneIndex, wantsPhoto, photoPreview, nickname]);

  return (
    <div className="relative flex items-center justify-center min-h-screen noise-bg text-white overflow-hidden">
      {/* Velvet overlay */}
      <div className="velvet-overlay" />

      {/* Background decorative lines */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[10%] left-[5%] w-px h-64 bg-gradient-to-b from-white/10 to-transparent" />
        <div className="absolute bottom-[20%] right-[8%] w-px h-96 bg-gradient-to-t from-primary/10 to-transparent" />
        <div className="absolute top-1/4 right-1/4 w-1 h-1 bg-white rounded-full opacity-20" />
        <div className="absolute bottom-1/3 left-1/3 w-1 h-1 bg-primary rounded-full opacity-40 blur-[1px]" />
        <div className="absolute top-2/3 right-1/2 w-0.5 h-0.5 bg-white rounded-full opacity-10" />
      </div>

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
            {/* Soul sphere halo — same as main page */}
            <div className="w-48 h-48 rounded-full border border-primary/40 flex items-center justify-center relative shadow-[0_0_50px_rgba(180,23,186,0.2)]">
              <div className="absolute inset-0 rounded-full soul-glow scale-150 animate-pulse" />
              <div className="w-4 h-4 rounded-full bg-primary shadow-[0_0_20px_#B417BA]" />
            </div>
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
                Name your companion
              </motion.h1>
              <motion.p
                className="text-sm text-white/50"
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
                className="w-full text-center text-2xl font-serif bg-transparent border-b border-white/10 focus:border-accent/50 pb-3 outline-none text-white/90 placeholder-white/30 transition-colors"
              />
            </motion.div>

            {/* Relationship */}
            <motion.div
              className="w-full space-y-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.6 }}
            >
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 text-center">
                Relationship
              </p>
              <DrumPicker
                options={RELATIONSHIP_OPTIONS}
                selectedIndex={relIndex}
                onSelect={setRelIndex}
              />
            </motion.div>

            {/* Tone */}
            <motion.div
              className="w-full space-y-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.6 }}
            >
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 text-center">
                Personality
              </p>
              <DrumPicker
                options={TONE_OPTIONS}
                selectedIndex={toneIndex}
                onSelect={setToneIndex}
              />
            </motion.div>

            {/* Photo Upload */}
            <motion.div
              className="w-full space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0, duration: 0.6 }}
            >
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 text-center">
                사진을 등록하시겠습니까?
              </p>
              <div className="flex justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setWantsPhoto(true)}
                  className={`px-6 py-2 rounded-full text-xs tracking-wide border transition-all ${
                    wantsPhoto === true
                      ? "bg-accent/20 border-accent/40 text-accent"
                      : "bg-white/[0.04] border-white/10 text-white/40 hover:border-accent/20 hover:text-accent/60"
                  }`}
                >
                  YES
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWantsPhoto(false);
                    setPhotoPreview(null);
                  }}
                  className={`px-6 py-2 rounded-full text-xs tracking-wide border transition-all ${
                    wantsPhoto === false
                      ? "bg-accent/20 border-accent/40 text-accent"
                      : "bg-white/[0.04] border-white/10 text-white/40 hover:border-accent/20 hover:text-accent/60"
                  }`}
                >
                  NO
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              {wantsPhoto === true && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center gap-3"
                >
                  {photoPreview ? (
                    /* Preview with re-drop support */
                    <div
                      className="relative w-48 h-48 rounded-lg overflow-hidden border border-accent/20 cursor-pointer group"
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-[10px] text-white/60 tracking-wide">
                          Click or drop to change
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* Drop zone */
                    <div
                      className={`w-48 h-48 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                        isDragging
                          ? "border-accent/60 bg-accent/10"
                          : "border-white/10 hover:border-accent/30"
                      }`}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <span className="text-[10px] text-white/40 tracking-wide">
                        Drop image here
                      </span>
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>

            {/* User Nickname */}
            <motion.div
              className="w-full space-y-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1, duration: 0.6 }}
            >
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 text-center">
                당신을 어떻게 불러드릴까요?
              </p>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Your name..."
                maxLength={30}
                className="w-full text-center text-lg font-serif bg-transparent border-b border-white/10 focus:border-accent/50 pb-2 outline-none text-white/90 placeholder-white/30 transition-colors"
              />
            </motion.div>

            {/* Submit */}
            <motion.button
              onClick={handleSubmit}
              disabled={!name.trim() || isSubmitting}
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
            className="fixed inset-0 flex items-center justify-center bg-black z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Expanding ring */}
            <motion.div
              className="absolute w-4 h-4 rounded-full border border-primary"
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
