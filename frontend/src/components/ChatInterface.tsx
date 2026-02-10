"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AudioPlayer from "./AudioPlayer";
import ResonanceRipple from "./ResonanceRipple";
import { fetchSpeech } from "@/lib/api";
import { useCompanionStore } from "@/lib/store";

interface ChatMessage {
  id: string;
  sender: "USER" | "AI";
  text: string;
  audioUrl?: string;
  isStreaming?: boolean;
  intent?: string;
  emotionColor?: string | null;
}

interface ChatInterfaceProps {
  companionId: string;
  companionName?: string;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/api/v1";

export default function ChatInterface({
  companionId,
  companionName = "Companion",
}: ChatInterfaceProps) {
  const backgroundImage = useCompanionStore((s) => s.backgroundImage);
  const userName = useCompanionStore((s) => s.userName);
  const userNameRef = useRef(userName);
  userNameRef.current = userName;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamingIdRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // WebSocket connection
  useEffect(() => {
    let cancelled = false;
    const ws = new WebSocket(`${WS_URL}/ws/${companionId}`);

    ws.onopen = () => {
      if (!cancelled) {
        wsRef.current = ws;
        setIsConnected(true);
      }
    };

    ws.onclose = () => {
      if (!cancelled) {
        setIsConnected(false);
      }
    };

    ws.onmessage = (event) => {
      if (cancelled) return;

      let data: { type?: string; content?: string; error?: string; intent?: string; emotion_color?: string | null };
      try {
        data = JSON.parse(event.data);
      } catch {
        console.warn("WebSocket: failed to parse message", event.data);
        return;
      }

      if (data.type === "stream") {
        // Check/set ref OUTSIDE the updater to avoid StrictMode double-invocation bug
        if (!streamingIdRef.current) {
          const newId = `ai-${Date.now()}`;
          streamingIdRef.current = newId;
          setMessages((prev) => [
            ...prev,
            { id: newId, sender: "AI", text: data.content ?? "", isStreaming: true },
          ]);
        } else {
          const streamId = streamingIdRef.current;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamId ? { ...m, text: m.text + (data.content ?? "") } : m
            )
          );
        }
      } else if (data.type === "end") {
        const streamId = streamingIdRef.current;
        if (streamId) {
          // Streaming existed — finalize it with intent + emotionColor
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamId
                ? { ...m, isStreaming: false, intent: data.intent, emotionColor: data.emotion_color }
                : m
            )
          );
        } else if (data.content) {
          // No streaming messages were received (e.g. backend error or
          // missed stream chunks). Show the full content as a complete message.
          setMessages((prev) => [
            ...prev,
            {
              id: `ai-${Date.now()}`,
              sender: "AI" as const,
              text: data.content ?? "",
              isStreaming: false,
              intent: data.intent,
              emotionColor: data.emotion_color,
            },
          ]);
        }
        streamingIdRef.current = null;
      }
    };

    return () => {
      cancelled = true;
      streamingIdRef.current = null;
      ws.close();
    };
  }, [companionId]);

  const sendMessage = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "USER",
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    wsRef.current.send(JSON.stringify({ message: trimmed, user_name: userNameRef.current }));
    setInput("");
  }, [input, isConnected]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSpeak = async (msg: ChatMessage) => {
    if (msg.audioUrl || loadingAudioId) return;
    setLoadingAudioId(msg.id);

    try {
      const result = await fetchSpeech(msg.text);
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, audioUrl: result.audio_url } : m))
      );
    } catch (err) {
      console.error("TTS error:", err);
    } finally {
      setLoadingAudioId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black text-white">
      {/* Photo banner area (Instagram-style) */}
      {backgroundImage && (
        <div className="relative w-full shrink-0" style={{ height: "30vh" }}>
          <img
            src={backgroundImage}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.06]">
        <div className="w-2 h-2 rounded-full" style={{
          backgroundColor: isConnected ? "#4ade80" : "#666",
        }} />
        <span className="text-sm font-light tracking-wide text-white/70">
          {companionName}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex flex-col ${
                msg.sender === "USER" ? "items-end" : "items-start"
              }`}
            >
              {/* Label */}
              <span className="text-[10px] uppercase tracking-widest text-white/30 mb-1.5">
                {msg.sender === "USER" ? (userName || "You") : companionName}
              </span>

              {/* Text */}
              <div className="relative overflow-hidden max-w-[80%]">
                {msg.sender === "AI" && !msg.isStreaming && msg.intent === "deep_emotional" && (
                  <ResonanceRipple emotionColor={msg.emotionColor} />
                )}
                <p
                  className={`text-sm leading-relaxed ${
                    msg.sender === "USER"
                      ? "text-white/60"
                      : "text-white/90 font-light"
                  }`}
                >
                  {msg.text}
                  {msg.isStreaming && (
                    <span className="inline-block w-1.5 h-4 ml-0.5 bg-[var(--accent)] animate-pulse rounded-sm" />
                  )}
                </p>
              </div>

              {/* Speak button + Audio player (AI messages only) */}
              {msg.sender === "AI" && !msg.isStreaming && (
                <div className="mt-2">
                  {msg.audioUrl ? (
                    <AudioPlayer audioUrl={msg.audioUrl} />
                  ) : (
                    <button
                      onClick={() => handleSpeak(msg)}
                      disabled={loadingAudioId === msg.id}
                      className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-[var(--accent)] transition-colors disabled:opacity-40"
                    >
                      {loadingAudioId === msg.id ? (
                        <span className="inline-block w-3 h-3 border border-white/30 border-t-[var(--accent)] rounded-full animate-spin" />
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 5L6 9H2v6h4l5 4V5z" />
                          <path d="M15.54 8.46a5 5 0 010 7.07" />
                          <path d="M19.07 4.93a10 10 0 010 14.14" />
                        </svg>
                      )}
                      {loadingAudioId === msg.id ? "Generating..." : "Listen"}
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Say something..."
            className="flex-1 bg-transparent text-sm text-white/90 placeholder-white/20 outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || !isConnected}
            className="text-white/30 hover:text-[var(--accent)] transition-colors disabled:opacity-20"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
