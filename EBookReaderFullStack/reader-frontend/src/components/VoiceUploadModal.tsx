"use client";

import { useState } from "react";
import { Upload, X } from "lucide-react";

export default function VoiceUploadModal({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [voiceId, setVoiceId] = useState("");
  const [emotion, setEmotion] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file || !voiceId || !emotion) return;

    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("voice_id", voiceId);
    formData.append("emotion", emotion);

    await fetch("http://127.0.0.1:8000/api/v2/books/voices/upload", {
      method: "POST",
      body: formData,
    });

    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-96 space-y-4 shadow-xl relative">

        {/* CLOSE */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-700"
        >
          <X size={18} />
        </button>

        <h2 className="font-bold text-lg">Yeni Ses Ekle</h2>

        {/* FILE PICKER */}
        <label className="border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition">
          <Upload size={24} className="text-slate-400" />
          <span className="text-xs text-slate-500 mt-2">
            WAV dosyası seç
          </span>

          {file && (
            <span className="text-[11px] mt-2 font-bold text-slate-700">
              {file.name}
            </span>
          )}

          <input
            type="file"
            accept=".wav"
            hidden
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>

        {/* VOICE ID */}
        <input
          className="w-full border p-2 rounded text-sm"
          placeholder="Voice ID (örn: canan)"
          value={voiceId}
          onChange={(e) => setVoiceId(e.target.value)}
        />

        {/* EMOTION */}
        <input
          className="w-full border p-2 rounded text-sm"
          placeholder="Emotion (neutral, happy, sad)"
          value={emotion}
          onChange={(e) => setEmotion(e.target.value)}
        />

        {/* ACTIONS */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="text-sm text-slate-500"
          >
            İptal
          </button>

          <button
            onClick={handleUpload}
            disabled={loading || !file}
            className="bg-indigo-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
          >
            {loading ? "Yükleniyor..." : "Yükle"}
          </button>
        </div>
      </div>
    </div>
  );
}
