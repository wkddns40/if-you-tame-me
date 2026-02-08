"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import type { DailyEmotion } from "@/lib/api";
import { fetchEmotions } from "@/lib/api";

interface EmotionCalendarProps {
  companionId: string;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function EmotionCalendar({ companionId }: EmotionCalendarProps) {
  const [emotions, setEmotions] = useState<DailyEmotion[]>([]);
  const [selected, setSelected] = useState<DailyEmotion | null>(null);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  useEffect(() => {
    fetchEmotions(companionId)
      .then(setEmotions)
      .catch(console.error);
  }, [companionId]);

  const emotionMap = useMemo(() => {
    const map: Record<string, DailyEmotion> = {};
    for (const e of emotions) {
      map[e.date] = e;
    }
    return map;
  }, [emotions]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const formatDate = (day: number) => {
    const m = String(month + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${m}-${d}`;
  };

  return (
    <div className="space-y-6">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="text-white/30 hover:text-white/60 transition-colors px-2 py-1">
          &larr;
        </button>
        <h2 className="font-serif text-lg text-white/70">
          {MONTHS[month]} {year}
        </h2>
        <button onClick={nextMonth} className="text-white/30 hover:text-white/60 transition-colors px-2 py-1">
          &rarr;
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[10px] uppercase tracking-wider text-white/20 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells before first day */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = formatDate(day);
          const emotion = emotionMap[dateStr];
          const isToday =
            day === now.getDate() &&
            month === now.getMonth() &&
            year === now.getFullYear();

          return (
            <motion.button
              key={day}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => emotion && setSelected(emotion)}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                isToday ? "bg-white/[0.06]" : "bg-white/[0.02] hover:bg-white/[0.04]"
              }`}
            >
              <span className="text-[11px] text-white/40">{day}</span>
              {emotion && (
                <div
                  className="w-2 h-2 rounded-full animate-glow-pulse"
                  style={{
                    backgroundColor: emotion.color_hex || "#808080",
                    boxShadow: `0 0 8px 2px ${emotion.color_hex || "#808080"}66`,
                  }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Selected emotion detail */}
      {selected && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{
                  backgroundColor: selected.color_hex || "#808080",
                  boxShadow: `0 0 12px 3px ${selected.color_hex || "#808080"}66`,
                }}
              />
              <span className="font-serif text-white/80">
                {selected.primary_emotion}
              </span>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-white/20 hover:text-white/50 text-xs"
            >
              Close
            </button>
          </div>
          <p className="text-sm text-white/50 leading-relaxed">
            {selected.summary_text}
          </p>
          {selected.key_quote && (
            <p className="text-xs text-white/30 italic border-l-2 border-accent/30 pl-3">
              &ldquo;{selected.key_quote}&rdquo;
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}
