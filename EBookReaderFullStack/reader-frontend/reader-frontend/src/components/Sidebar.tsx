"use client";

import React, { useState, useEffect } from 'react';
import { Book as BookIcon, Plus, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { BookSummary, api, VoiceStyle } from '@/lib/api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  books: BookSummary[];
  selectedBookId?: string;
  onSelectBook: (id: string) => void;
  onUploadSuccess: (id: string) => void;
}

export default function Sidebar({ books, selectedBookId, onSelectBook, onUploadSuccess }: SidebarProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<VoiceStyle[]>([]);
  const [voiceId, setVoiceId] = useState('Damien Black');
  const [speed, setSpeed] = useState(1.0);
  const [steps, setSteps] = useState(10);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const voices = await api.getVoices();
        setAvailableVoices(voices);
        if (voices.length > 0 && !voices.find(v => v.id === voiceId)) setVoiceId(voices[0].id);
      } catch (e) { console.error("Voices failed:", e); }
    };
    fetchVoices();
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await api.getSettings();
        if (settings && Object.keys(settings).length > 0) {
          if (settings.voiceId) setVoiceId(settings.voiceId);
          if (settings.speed) setSpeed(settings.speed);
          if (settings.steps) setSteps(settings.steps);
        }
      } finally { setIsLoaded(true); }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(() => api.updateSettings({ voiceId, speed, steps }), 1000);
    return () => clearTimeout(timer);
  }, [voiceId, speed, steps, isLoaded]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('voice_id', voiceId);
    formData.append('speed', speed.toString());
    formData.append('steps', steps.toString());
    try {
      const data = await api.uploadBook(formData);
      if (data) onUploadSuccess(data.book_id);
    } finally { setIsUploading(false); }
  };

  return (
    <div className={cn(
      "h-full bg-white border-r border-slate-200 flex flex-col shadow-xl z-20 transition-all duration-500 ease-in-out relative",
      isCollapsed ? "w-0 border-none" : "w-64"
    )}>
      {/* Toggle Button - Outside the flow */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          "absolute -right-4 top-8 w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-[#d47a06] transition-all z-50 shadow-md",
          isCollapsed && "right-[-32px]"
        )}
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Content Container */}
      <div className={cn(
        "flex flex-col h-full transition-opacity duration-300 overflow-hidden",
        isCollapsed ? "opacity-0 invisible" : "opacity-100 visible"
      )}>
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-extrabold text-slate-800 flex items-center gap-2 tracking-tight text-lg">
              <BookIcon size={20} className="text-[#d47a06]" /> eBookBot
            </h1>
            <label className="cursor-pointer p-1.5 hover:bg-slate-50 rounded-lg border border-slate-200 shadow-sm active:scale-95">
                <Plus size={18} className="text-slate-500" />
                <input type="file" accept=".epub" hidden onChange={handleFileUpload} disabled={isUploading} />
            </label>
          </div>

          <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-inner">
            <select
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-bold outline-none focus:border-[#d47a06]"
              >
                {availableVoices.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
            </select>
            <div className="flex gap-2 items-center">
              <input type="range" min="0.9" max="1.4" step="0.1" value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} className="w-full accent-[#d47a06]" />
              <span className="text-[10px] font-bold text-slate-500">{speed}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {books.map((book) => (
            <button
              key={book.id}
              onClick={() => onSelectBook(book.id)}
              className={cn(
                "w-full text-left p-4 rounded-2xl transition-all border",
                selectedBookId === book.id ? "bg-white border-[#d47a06] text-slate-900 shadow-md" : "text-slate-500 border-transparent hover:bg-slate-50"
              )}
            >
              <span className="font-bold truncate text-[11px] uppercase block">{book.title}</span>
              <span className="text-[8px] opacity-60 uppercase">{book.status}</span>
            </button>
          ))}
          {isUploading && (
            <div className="p-4 flex items-center gap-3 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Loader2 className="animate-spin" size={14} />
              <span className="text-[9px] font-bold uppercase tracking-widest">Processing...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}