const API_BASE_URL = "http://127.0.0.1:8000/api/v2";


export interface VoiceStyle {
  id: string;
  name: string;
  emotions: string[];
}

export interface Chunk {
  index: number;
  text: string;
  status: string;
  duration?: number;
  word_timestamps?: Array<{ word: string; start: number; end: number }>;
}

export interface Book {
  id: string;
  title: string;
  author?: string;
  status: string;
  voice_id: string;
  speed: number;
  steps: number;
  total_chunks: number;
  last_chunk_index: number;
}

export interface BookSummary {
  id: string;
  title: string;
  author?: string;
  status: string;
}

export const api = {
  getVoices: async (): Promise<VoiceStyle[]> => {
    try {
      const res = await fetch(`${API_BASE_URL}/voices/`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error("Ses listesi alinamadi:", e);
      return [];
    }
  },

  getBooks: async (): Promise<BookSummary[]> => {
    try {
      const res = await fetch(`${API_BASE_URL}/books/`, { cache: 'no-store' });
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error("Kitaplar getirilemedi:", e);
      return [];
    }
  },

    deleteBook: async (bookId: string) => {
  await fetch(`${API_BASE_URL}/books/${bookId}`, {
    method: "DELETE",
  });
},
  getBook: async (id: string): Promise<Book | null> => {
    try {
      const res = await fetch(`${API_BASE_URL}/books/${id}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error("Kitap detayi alinamadi:", e);
      return null;
    }
  },

    downloadVideo(bookId: string) {
  return fetch(`${API_BASE_URL}/books/${bookId}/download-video`, {
    method: "GET",
  });
},


  getChunks: async (id: string, offset: number = 0, limit: number = 50): Promise<Chunk[]> => {
    try {
      const res = await fetch(`${API_BASE_URL}/books/${id}/chunks?offset=${offset}&limit=${limit}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error("Parcalar yuklenemedi:", e);
      return [];
    }
  },

  uploadBook: async (formData: FormData): Promise<{ book_id: string } | null> => {
    try {
      const res = await fetch(`${API_BASE_URL}/books/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      return await res.json();
    } catch (e) {
      console.error("Kitap yukleme hatasi:", e);
      return null;
    }
  },

  getAudioUrl: (bookId: string, chunkIndex: number) => {
    return `${API_BASE_URL}/books/${bookId}/audio/${chunkIndex}`;
  },

  updateProgress: async (bookId: string, lastIndex: number) => {
    try {
      await fetch(`${API_BASE_URL}/books/${bookId}/progress?last_index=${lastIndex}`, {
        method: 'PATCH',
      });
    } catch (e) {
      console.error("Ilerleme kaydedilemedi:", e);
    }
  },

  getSettings: async (): Promise<Record<string, any>> => {
    try {
      const res = await fetch(`${API_BASE_URL}/settings/`);
      if (!res.ok) return {};
      return await res.json();
    } catch (e) {
      console.error("Ayarlar getirilemedi:", e);
      return {};
    }
  },

  updateSettings: async (settings: Record<string, any>) => {
    try {
      await fetch(`${API_BASE_URL}/settings/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
    } catch (e) {
      console.error("Ayarlar kaydedilemedi:", e);
    }
  }
};