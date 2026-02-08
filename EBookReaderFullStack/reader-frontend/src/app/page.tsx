"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Reader from '@/components/Reader';
import { Book, BookSummary, api } from '@/lib/api';
import { Loader2, BookOpen } from 'lucide-react';

export default function Home() {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isLoadingBooks, setIsLoadingBooks] = useState(false);
  const [isLoadingBook, setIsLoadingBook] = useState(false);

const fetchBooks = async () => {

  try {
    const data = await api.getBooks();
    setBooks(data || []);
  } catch (error) {
    console.error("Library fetch error:", error);
    setBooks([]);
  } finally {

    setTimeout(() => setIsLoadingBooks(false), 500);
  }
};

  const fetchBookDetails = async (id: string, isBackground = false) => {
    if (!isBackground) setIsLoadingBook(true);
    try {
      const data = await api.getBook(id);
      setSelectedBook(data);
    } catch (error) {
      console.error("Failed to fetch book details", error);
    } finally {
      if (!isBackground) setIsLoadingBook(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const handleSelectBook = (id: string) => {
    fetchBookDetails(id);
  };

  const handleUploadSuccess = (id: string) => {
    fetchBooks();
    fetchBookDetails(id);
  };

  return (
    <main className="flex h-screen w-full bg-white overflow-hidden font-sans antialiased text-slate-900 border border-slate-200">
      <Sidebar
        books={books}
        selectedBookId={selectedBook?.id}
        onSelectBook={handleSelectBook}
        onUploadSuccess={handleUploadSuccess}
      />

      <div className="flex-1 h-full flex flex-col relative">
        {isLoadingBooks || (isLoadingBook && !selectedBook) ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-slate-50/50">
            <Loader2 className="animate-spin text-indigo-600" size={40} />
            <p className="text-slate-500 font-medium">Loading your library...</p>
          </div>
        ) : selectedBook ? (
          <Reader
            book={selectedBook}
            onRefresh={() => fetchBookDetails(selectedBook.id, true)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-slate-50/50 p-10 text-center">
            <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center shadow-inner relative group">
              <BookOpen size={48} className="group-hover:scale-110 transition-transform" />
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 border-4 border-white rounded-full"></div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-800">Welcome to eBookBot</h2>
              <p className="text-slate-500 max-w-sm mx-auto">
                Select a book from the sidebar or upload a new EPUB to start listening with AI-powered voices.
              </p>
            </div>
            <button
              onClick={() => {
                const uploadBtn = document.querySelector('input[type="file"]') as HTMLInputElement;
                uploadBtn?.click();
              }}
              className="px-6 py-2 bg-indigo-600 text-white rounded-full font-semibold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100"
            >
                Get Started
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
