"use client";

import React, { useState, useEffect } from "react";
import {
  Book as BookIcon,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Settings,
  Trash2,
} from "lucide-react";
import { BookSummary, api, VoiceStyle } from "@/lib/api";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import VoiceUploadModal from "@/components/VoiceUploadModal";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  books: BookSummary[];
  selectedBookId?: string;
  onSelectBook: (id: string) => void;
  onUploadSuccess: (id: string) => void;
}

export default function Sidebar({
  books,
  selectedBookId,
  onSelectBook,
  onUploadSuccess,
}: SidebarProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [availableVoices, setAvailableVoices] = useState<VoiceStyle[]>([]);
  const [voiceId, setVoiceId] = useState("canan");
  const [speed, setSpeed] = useState(1.0);
  const [steps, setSteps] = useState(10);
  const [isLoaded, setIsLoaded] = useState(false);

  const [showVoiceUpload, setShowVoiceUpload] = useState(false);

  // ======================
  // LOAD VOICES
  // ======================
  useEffect(() => {
    api.getVoices().then(setAvailableVoices);
  }, []);

  // ======================
  // LOAD SETTINGS
  // ======================
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await api.getSettings();
      if (settings.voiceId) setVoiceId(settings.voiceId);
      if (settings.speed) setSpeed(settings.speed);
      if (settings.steps) setSteps(settings.steps);
      setIsLoaded(true);
    };
    loadSettings();
  }, []);

  // ======================
  // SAVE SETTINGS
  // ======================
  useEffect(() => {
    if (!isLoaded) return;
    const t = setTimeout(() => {
      api.updateSettings({ voiceId, speed, steps });
    }, 800);
    return () => clearTimeout(t);
  }, [voiceId, speed, steps, isLoaded]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setIsUploading(true);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("voice_id", voiceId);
  formData.append("speed", speed.toString());
  formData.append("steps", steps.toString());

  try {
    const res = await api.uploadBook(formData);
    if (res?.book_id) {
      onUploadSuccess(res.book_id);
    }
  } catch (err) {
    console.error("Upload failed:", err);
    alert("Kitap yüklenemedi");
  } finally {
    setIsUploading(false);
    e.target.value = ""; // aynı dosya tekrar seçilebilsin
  }
};


  // ======================
  // DELETE BOOK
  // ======================
  const handleDeleteBook = async (
    e: React.MouseEvent,
    bookId: string,
    title: string
  ) => {
    e.stopPropagation();

    const ok = confirm(`"${title}" kitabını silmek istiyor musun?`);
    if (!ok) return;

    await api.deleteBook(bookId);
    window.location.reload();
  };

  return (
    <div
      className={cn(
        "h-full bg-white border-r border-slate-200 flex flex-col shadow-xl z-20 transition-all duration-500 relative",
        isCollapsed ? "w-0 border-none" : "w-64"
      )}
    >
      {/* COLLAPSE BUTTON */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-4 top-8 w-8 h-8 bg-white border rounded-full flex items-center justify-center shadow-md z-50"
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div
        className={cn(
          "flex flex-col h-full transition-opacity duration-300 overflow-hidden",
          isCollapsed ? "opacity-0 invisible" : "opacity-100 visible"
        )}
      >
        {/* HEADER */}
        <div className="p-4 border-b">
          <div className="flex justify-between items-center mb-4">
            <h1 className="font-extrabold flex items-center gap-2">
              <BookIcon size={20} className="text-[#d47a06]" />
              eBookBot
            </h1>

            <label className="cursor-pointer hover:text-[#d47a06] transition">
              <Plus size={18} />
              <input
  type="file"
  accept=".epub"
  hidden
  onChange={handleFileUpload}
/>
            </label>
          </div>

          {/* SETTINGS */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border">
            <select
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              className="w-full text-xs border rounded p-2 font-semibold"
            >
              {availableVoices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.9"
                max="1.4"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full accent-[#d47a06]"
              />
              <span className="text-[10px] font-bold">{speed}</span>
            </div>

            <button
              onClick={() => setShowVoiceUpload(true)}
              className="flex items-center gap-2 text-[10px] text-slate-500 hover:text-indigo-600 underline"
            >
              <Settings size={12} />
              Yeni Ses Ekle
            </button>
          </div>
        </div>

        {/* BOOK LIST */}
        <div className="flex-1 overflow-y-auto px-3">
          {books.map((book) => (
            <div
              key={book.id}
              onClick={() => onSelectBook(book.id)}
              className={cn(
                "group flex items-center justify-between gap-2 py-3 border-b cursor-pointer transition",
                selectedBookId === book.id
                  ? "border-b-[#d47a06] bg-slate-50"
                  : "border-b-slate-200 hover:bg-slate-50"
              )}
            >
              {/* BOOK INFO (LEFT) */}
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold truncate">
                  {book.title}
                </div>
                <div className="text-[9px] uppercase text-slate-400">
                  {book.status}
                </div>
              </div>

              {/* DELETE BUTTON (RIGHT – FIXED WIDTH) */}
              <button
                onClick={(e) =>
                  handleDeleteBook(e, book.id, book.title)
                }
                className="flex-shrink-0 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {isUploading && (
            <div className="p-3 flex items-center gap-2 text-slate-400 text-xs">
              <Loader2 size={14} className="animate-spin" />
              Processing...
            </div>
          )}
        </div>
      </div>

      {showVoiceUpload && (
        <VoiceUploadModal onClose={() => setShowVoiceUpload(false)} />
      )}
    </div>
  );
}
