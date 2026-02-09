"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface AudioPlayerProps {
  audioUrl: string;
}

const BAR_COUNT = 40;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const CANVAS_HEIGHT = 48;
const CANVAS_WIDTH = BAR_COUNT * (BAR_WIDTH + BAR_GAP);

export default function AudioPlayer({ audioUrl }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const setupAnalyser = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || sourceRef.current) return;

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaElementSource(audio);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;

    source.connect(analyser);
    analyser.connect(audioCtx.destination);

    ctxRef.current = audioCtx;
    sourceRef.current = source;
    analyserRef.current = analyser;
  }, []);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      for (let i = 0; i < BAR_COUNT; i++) {
        const dataIndex = Math.floor((i / BAR_COUNT) * bufferLength);
        const value = dataArray[dataIndex] / 255;
        const barHeight = Math.max(2, value * CANVAS_HEIGHT);
        const x = i * (BAR_WIDTH + BAR_GAP);
        const y = (CANVAS_HEIGHT - barHeight) / 2;

        const intensity = 0.3 + value * 0.7;
        ctx.fillStyle = `rgba(168, 130, 255, ${intensity})`;
        ctx.beginPath();
        ctx.roundRect(x, y, BAR_WIDTH, barHeight, 1.5);
        ctx.fill();
      }
    };

    draw();
  }, []);

  const drawIdleWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    for (let i = 0; i < BAR_COUNT; i++) {
      const barHeight = 4 + Math.sin(i * 0.3) * 3;
      const x = i * (BAR_WIDTH + BAR_GAP);
      const y = (CANVAS_HEIGHT - barHeight) / 2;

      ctx.fillStyle = "rgba(168, 130, 255, 0.3)";
      ctx.beginPath();
      ctx.roundRect(x, y, BAR_WIDTH, barHeight, 1.5);
      ctx.fill();
    }
  }, []);

  useEffect(() => {
    drawIdleWaveform();
  }, [drawIdleWaveform]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      cancelAnimationFrame(animFrameRef.current);
      drawIdleWaveform();
    } else {
      setupAnalyser();
      if (ctxRef.current?.state === "suspended") {
        await ctxRef.current.resume();
      }
      await audio.play();
      setIsPlaying(true);
      drawWaveform();
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setProgress(audio.currentTime);
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(audio.duration);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    cancelAnimationFrame(animFrameRef.current);
    drawIdleWaveform();
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * duration;
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 max-w-sm">
      {/* Play / Pause */}
      <button
        onClick={togglePlay}
        className="flex-shrink-0 w-9 h-9 rounded-full bg-accent flex items-center justify-center hover:brightness-110 transition-colors"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
            <rect x="2" y="1" width="3.5" height="12" rx="1" />
            <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
            <path d="M3 1.5v11l9-5.5z" />
          </svg>
        )}
      </button>

      {/* Waveform + progress */}
      <div className="flex-1 flex flex-col gap-1">
        <div className="cursor-pointer" onClick={handleSeek}>
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="w-full"
            style={{ height: `${CANVAS_HEIGHT}px` }}
          />
          {/* Progress bar */}
          {duration > 0 && (
            <div className="w-full h-0.5 bg-white/10 rounded-full mt-1">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: `${(progress / duration) * 100}%` }}
              />
            </div>
          )}
        </div>
        <div className="flex justify-between text-[10px] text-white/40 font-mono">
          <span>{formatTime(progress)}</span>
          <span>{duration > 0 ? formatTime(duration) : "--:--"}</span>
        </div>
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />
    </div>
  );
}
