"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
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
import { Literata, Manrope } from "next/font/google";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const font = Literata({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
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

  const [isPlaying, setIsPlaying] = useState(false);
  const [theme, setTheme] = useState<Theme>("ocean");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ambientVolume, setAmbientVolume] = useState(0.4);
  const [isAmbientMuted, setIsAmbientMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const ambientRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const ambientSounds = {
    ocean: "/voice/audio/ocean.mp3",
    fire: "/voice/audio/fire.mp3",
  };

  // ======================
  // LOAD CHUNKS
  // ======================
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api.getChunks(book.id, 0, book.total_chunks);
        if (alive) setChunks(data);
      } catch (e) {
        console.error("Chunk yüklenemedi:", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [book.id, book.total_chunks]);

  const currentChunk = useMemo(
    () => chunks.find((c) => c.index === activeChunkIndex),
    [chunks, activeChunkIndex]
  );

  // ======================
  // AUDIO LOAD & PLAY
  // ======================
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.src = api.getAudioUrl(book.id, activeChunkIndex);
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }, [book.id, activeChunkIndex]);

  // ======================
  // AUTO NEXT CHUNK
  // ======================
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      if (activeChunkIndex < book.total_chunks - 1) {
        setActiveChunkIndex((i) => i + 1);
        api.updateProgress(book.id, activeChunkIndex + 1);
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [activeChunkIndex, book.total_chunks]);

  // ======================
  // AMBIENT
  // ======================
  useEffect(() => {
    const ambient = ambientRef.current;
    if (!ambient) return;

    ambient.loop = true;
    ambient.volume = isAmbientMuted ? 0 : ambientVolume;

    if (isPlaying) ambient.play().catch(() => {});
    else ambient.pause();
  }, [isPlaying, ambientVolume, isAmbientMuted, theme]);

  // ======================
  // FULLSCREEN
  // ======================
  const toggleFullScreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  useEffect(() => {
    const fs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fs);
    return () => document.removeEventListener("fullscreenchange", fs);
  }, []);

  // ======================
  // UI
  // ======================
  return (
    <div
      ref={containerRef}
      className={cn(
        font.className,
        "reader-root flex-1 flex flex-col h-full bg-black overflow-hidden relative"
      )}
    >
      <audio ref={audioRef} />
      <audio ref={ambientRef} src={ambientSounds[theme]} key={theme} />

      {/* BACKGROUND */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {theme === "ocean" ? (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#001a2c_0%,_#000_100%)] animate-pulse duration-[4000ms]" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-t from-[#3a0f02] via-black to-black animate-pulse duration-[3000ms]" />
        )}
      </div>

      {/* TOOLBAR */}
      <div className="h-24 flex items-center justify-between px-10 bg-black/40 backdrop-blur-xl z-10">
        {/* LEFT */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => setTheme("ocean")}
            className={theme === "ocean" ? "text-cyan-400" : "text-white/30"}
          >
            <Waves />
          </button>

          <button
            onClick={() => setTheme("fire")}
            className={theme === "fire" ? "text-orange-400" : "text-white/30"}
          >
            <Flame />
          </button>

          <button
            onClick={() =>
              setActiveChunkIndex((i) => Math.max(0, i - 1))
            }
            className="text-white/40 hover:text-white"
          >
            <SkipBack />
          </button>

          {/* PLAY */}
          <button
            onClick={() => {
              const audio = audioRef.current;
              if (!audio) return;

              if (isPlaying) {
                audio.pause();
                setIsPlaying(false);
              } else {
                audio.play().then(() => setIsPlaying(true));
              }
            }}
            className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl transition",
              theme === "ocean"
                ? "bg-cyan-600 hover:bg-cyan-500 text-white"
                : "bg-orange-600 hover:bg-orange-500 text-white"
            )}
          >
            {isPlaying ? <Pause /> : <Play className="ml-0.5" />}
          </button>

          <button
            onClick={() =>
              setActiveChunkIndex((i) =>
                Math.min(book.total_chunks - 1, i + 1)
              )
            }
            className="text-white/40 hover:text-white"
          >
            <SkipForward />
          </button>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-4">
          {/* DOWNLOAD */}
          <button
            onClick={async () => {
              const res = await api.downloadVideo(book.id);
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);

              const a = document.createElement("a");
              a.href = url;
              a.download = `${book.title || "audiobook"}.mp4`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="px-4 py-2 rounded-xl bg-white/10 text-white/80 hover:bg-white/20 transition"
          >
            Video indir
          </button>

          <button
            onClick={() => setIsAmbientMuted(!isAmbientMuted)}
            className="text-white/70 hover:text-white"
          >
            {isAmbientMuted ? <VolumeX /> : <Volume2 />}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={ambientVolume}
            onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
            className="accent-white w-24"
          />

          <button
            onClick={toggleFullScreen}
            className="text-white/60 hover:text-white"
          >
            {isFullscreen ? <Minimize /> : <Maximize />}
          </button>
        </div>
      </div>

      {/* TEXT */}
      <div className="flex-1 flex items-center justify-center px-16 z-10">
        {currentChunk ? (
          <p
            key={activeChunkIndex}
            className={cn(
              manrope.className,
              "text-5xl leading-[1.35] text-[#b8b2a6] text-center animate-in fade-in zoom-in-95 duration-1000"
            )}
          >
            {currentChunk.text}
          </p>
        ) : (
          <Loader2 className="animate-spin text-white/20" size={64} />
        )}
      </div>
    </div>
  );
}
