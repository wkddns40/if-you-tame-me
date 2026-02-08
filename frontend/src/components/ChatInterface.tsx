"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AudioPlayer from "./AudioPlayer";
import { fetchSpeech } from "@/lib/api";

interface ChatMessage {
  id: string;
  sender: "USER" | "AI";
  text: string;
  audioUrl?: string;
  isStreaming?: boolean;
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
    const ws = new WebSocket(`${WS_URL}/ws/${companionId}`);
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "stream") {
        setMessages((prev) => {
          const streamId = streamingIdRef.current;
          if (!streamId) {
            // Start a new AI message
            const newId = `ai-${Date.now()}`;
            streamingIdRef.current = newId;
            return [
              ...prev,
              { id: newId, sender: "AI", text: data.content, isStreaming: true },
            ];
          }
          // Append to existing streaming message
          return prev.map((m) =>
            m.id === streamId ? { ...m, text: m.text + data.content } : m
          );
        });
      }

      if (data.type === "end") {
        const streamId = streamingIdRef.current;
        if (streamId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamId ? { ...m, isStreaming: false } : m
            )
          );
          streamingIdRef.current = null;
        }
      }
    };

    return () => {
      ws.close();
    };
  }, [companionId]);

  const sendMessage = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !wsRef.current || !isConnected) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "USER",
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    wsRef.current.send(JSON.stringify({ message: trimmed }));
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
      const blob = await fetchSpeech(msg.text);
      const url = URL.createObjectURL(blob);
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, audioUrl: url } : m))
      );
    } catch (err) {
      console.error("TTS error:", err);
    } finally {
      setLoadingAudioId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black text-white">
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
                {msg.sender === "USER" ? "You" : companionName}
              </span>

              {/* Text */}
              <p
                className={`text-sm leading-relaxed max-w-[80%] ${
                  msg.sender === "USER"
                    ? "text-white/60"
                    : "text-white/90 font-light"
                }`}
              >
                {msg.text}
                {msg.isStreaming && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-[#a882ff] animate-pulse rounded-sm" />
                )}
              </p>

              {/* Speak button + Audio player (AI messages only) */}
              {msg.sender === "AI" && !msg.isStreaming && (
                <div className="mt-2">
                  {msg.audioUrl ? (
                    <AudioPlayer audioUrl={msg.audioUrl} />
                  ) : (
                    <button
                      onClick={() => handleSpeak(msg)}
                      disabled={loadingAudioId === msg.id}
                      className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-[#a882ff] transition-colors disabled:opacity-40"
                    >
                      {loadingAudioId === msg.id ? (
                        <span className="inline-block w-3 h-3 border border-white/30 border-t-[#a882ff] rounded-full animate-spin" />
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
            className="text-white/30 hover:text-[#a882ff] transition-colors disabled:opacity-20"
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
