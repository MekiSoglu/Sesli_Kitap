"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Loader2,
  Waves,
  Flame,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Book, Chunk, api } from "@/lib/api";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Manrope } from "next/font/google";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

type Theme = "ocean" | "fire";

export default function Reader({
  book,
  onRefresh,
}: {
  book: Book;
  onRefresh: () => void;
}) {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [activeChunkIndex, setActiveChunkIndex] = useState<number>(
    book.last_chunk_index || 0
  );
  const [activeWordIndex, setActiveWordIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [theme, setTheme] = useState<Theme>("ocean");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ambientVolume, setAmbientVolume] = useState(0.4);
  const [isAmbientMuted, setIsAmbientMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const ambientRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const ambientSounds = {
    ocean: "voice/audio/ocean.mp3",
    fire: "voice/audio/fire.mp3",
  };

  // Ambient volume sync + play/pause
  useEffect(() => {
    if (!ambientRef.current) return;
    const targetVolume = isAmbientMuted ? 0 : ambientVolume;
    ambientRef.current.volume = targetVolume;
    ambientRef.current.loop = true;

    if (isPlaying) {
      ambientRef.current.play().catch(() => {
        console.log("Sistem etkileşim bekliyor...");
      });
    } else {
      ambientRef.current.pause();
    }
  }, [ambientVolume, isAmbientMuted, isPlaying, theme]);

  // Fullscreen toggle (use component root, not documentElement)
  const toggleFullScreen = () => {
    const el = containerRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  // Track fullscreen state (ESC, etc.)
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Load chunks
  useEffect(() => {
    const load = async () => {
      const data = await api.getChunks(book.id, 0, book.total_chunks);
      setChunks(data);
    };
    load();
  }, [book.id, book.total_chunks]);

  const currentChunk = chunks.find((c) => c.index === activeChunkIndex);

  const playChunk = (index: number) => {
    if (index < 0 || index >= book.total_chunks) return;

    setActiveChunkIndex(index);
    setActiveWordIndex(-1);
    api.updateProgress(book.id, index);

    if (audioRef.current) {
      audioRef.current.src = api.getAudioUrl(book.id, index);
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  // Sync active word with timestamps
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let frameId: number;

    const sync = () => {
      if (currentChunk?.word_timestamps && isPlaying) {
        const idx = currentChunk.word_timestamps.findIndex(
          (w) => audio.currentTime >= w.start && audio.currentTime <= w.end
        );
        if (idx !== -1 && idx !== activeWordIndex) setActiveWordIndex(idx);
      }
      frameId = requestAnimationFrame(sync);
    };

    if (isPlaying) frameId = requestAnimationFrame(sync);

    audio.onended = () => {
      if (activeChunkIndex < book.total_chunks - 1) playChunk(activeChunkIndex + 1);
      else setIsPlaying(false);
    };

    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, currentChunk, activeChunkIndex, activeWordIndex, book.total_chunks]);

  return (
    <div
      ref={containerRef}
      className={cn(
        manrope.className,
        "reader-root flex-1 flex flex-col h-full bg-black overflow-hidden relative outline-none border-none"
      )}
    >
      <audio ref={audioRef} />
      <audio ref={ambientRef} src={ambientSounds[theme]} key={theme} />

      {/* --- GELİŞMİŞ DİNAMİK ARKA PLAN --- */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {theme === "ocean" ? (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_#001a2c_0%,_#000000_100%)] animate-pulse duration-[4000ms]" />
        ) : (
          <div className="absolute inset-0 animate-in fade-in duration-1000">
            {/* Taban Isı Gradyanı */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#3a0f02] via-black to-black animate-pulse duration-[3000ms] opacity-80" />

            {/* Katman 1: Küçük, Hızlı Kıvılcımlar */}
            {[...Array(25)].map((_, i) => (
              <div
                key={`s-${i}`}
                className="absolute rounded-full bg-orange-400 shadow-[0_0_5px_#f97316] animate-rise"
                style={{
                  left: `${Math.random() * 100}%`,
                  bottom: "-20px",
                  width: `${Math.random() * 2 + 1}px`,
                  height: `${Math.random() * 2 + 1}px`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${Math.random() * 3 + 2}s`,
                }}
              />
            ))}

            {/* Katman 2: Orta, Daha Yavaş Közler */}
            {[...Array(15)].map((_, i) => (
              <div
                key={`m-${i}`}
                className="absolute rounded-full bg-orange-600 shadow-[0_0_10px_#ea580c] animate-rise"
                style={{
                  left: `${Math.random() * 100}%`,
                  bottom: "-30px",
                  width: `${Math.random() * 4 + 2}px`,
                  height: `${Math.random() * 4 + 2}px`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${Math.random() * 5 + 4}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="h-24 border-b border-white/5 flex items-center justify-between px-10 bg-black/40 backdrop-blur-3xl z-50">
        <div className="flex items-center gap-8">
          <div className="flex items-center bg-white/5 p-1 rounded-2xl border border-white/10 gap-1">
            <button
              onClick={() => setTheme("ocean")}
              className={cn(
                "p-2 rounded-xl transition-all",
                theme === "ocean" ? "bg-cyan-600 text-white" : "text-white/20"
              )}
            >
              <Waves size={18} />
            </button>
            <button
              onClick={() => setTheme("fire")}
              className={cn(
                "p-2 rounded-xl transition-all",
                theme === "fire" ? "bg-orange-600 text-white" : "text-white/20"
              )}
            >
              <Flame size={18} />
            </button>
          </div>

          <div className="flex items-center gap-4 border-l border-white/10 pl-6">
            <button
              onClick={() => playChunk(activeChunkIndex - 1)}
              className="text-white/20 hover:text-white"
            >
              <SkipBack size={24} />
            </button>

            <button
              onClick={() => {
                if (isPlaying) {
                  audioRef.current?.pause();
                } else {
                  audioRef.current?.src
                    ? audioRef.current.play()
                    : playChunk(activeChunkIndex);
                }
                setIsPlaying(!isPlaying);
              }}
              className={cn(
                "w-14 h-14 flex items-center justify-center text-white rounded-2xl shadow-2xl transition-all",
                theme === "ocean" ? "bg-cyan-600" : "bg-orange-600"
              )}
            >
              {isPlaying ? (
                <Pause size={28} fill="currentColor" />
              ) : (
                <Play size={28} fill="currentColor" className="ml-1" />
              )}
            </button>

            <button
              onClick={() => playChunk(activeChunkIndex + 1)}
              className="text-white/20 hover:text-white"
            >
              <SkipForward size={24} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-2xl border border-white/10">
            <button
              onClick={() => setIsAmbientMuted(!isAmbientMuted)}
              className="text-white"
            >
              {isAmbientMuted || ambientVolume === 0 ? (
                <VolumeX size={18} />
              ) : (
                <Volume2 size={18} />
              )}
            </button>

            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={ambientVolume}
              onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
              className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>

          <button
            onClick={toggleFullScreen}
            className="text-white/20 hover:text-white transition-all"
          >
            {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
          </button>
        </div>
      </div>

      {/* Metin */}
      <div className="flex-1 flex items-center justify-center p-12 relative z-10">
        <div className="max-w-5xl w-full text-center">
          {currentChunk ? (
            <div
              key={activeChunkIndex}
              className="animate-in fade-in zoom-in-95 duration-1000 ease-out"
            >
              <div className="flex flex-wrap justify-center gap-x-10 gap-y-16">
                {currentChunk.text.split(/\s+/).map((word, wIdx) => {
                  const isActive = activeWordIndex === wIdx;

                  return (
                    <span
                      key={wIdx}
                      className={cn(
                        "text-6xl font-medium transition-all duration-300 tracking-tight select-none",
                        isActive
                          ? "text-white font-semibold scale-125 drop-shadow-[0_0_50px_rgba(255,255,255,0.9)] opacity-100"
                          : "text-white/40 font-normal scale-95"
                      )}
                      style={{ textShadow: isActive ? `0 0 24px white` : "none" }}
                    >
                      {word}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : (
            <Loader2 className="animate-spin text-white/10" size={64} />
          )}
        </div>
      </div>

      {/* Global CSS */}
      <style jsx global>{`
        html,
        body {
          margin: 0;
          padding: 0;
          background: #000;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        .reader-root:fullscreen {
          background: #000;
          outline: none !important;
          border: none !important;
        }

        @keyframes rise {
          0% {
            transform: translateY(0) scale(1);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translateY(-120vh) scale(0.5);
            opacity: 0;
          }
        }
        .animate-rise {
          animation: rise linear infinite;
        }
      `}</style>
    </div>
  );
}
