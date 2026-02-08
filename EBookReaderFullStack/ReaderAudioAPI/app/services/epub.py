import re
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup


def clean_text_for_tts(text: str) -> str:

    text = re.sub(r'[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ.,!?;:\s\-\'\"]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def split_long_sentence(sentence: str, max_chars: int) -> list:
    chunks = []
    while len(sentence) > max_chars:
        split_at = sentence.rfind(' ', 0, max_chars)
        if split_at == -1:
            split_at = max_chars
        chunks.append(sentence[:split_at].strip())
        sentence = sentence[split_at:].strip()
    if sentence:
        chunks.append(sentence)
    return chunks


def extract_chapters_iteratively(epub_path: str):
    book = epub.read_epub(epub_path)
    title = book.get_metadata('DC', 'title')[0][0] if book.get_metadata('DC', 'title') else "Unknown"
    author = book.get_metadata('DC', 'creator')[0][0] if book.get_metadata('DC', 'creator') else "Unknown"

    yield {"type": "metadata", "title": title, "author": author}

    MAX_LIMIT_CHARS = 180

    current_buffer = ""

    for item in book.get_items():
        if item.get_type() == ebooklib.ITEM_DOCUMENT:
            soup = BeautifulSoup(item.get_content(), 'html.parser')
            elements = soup.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

            for el in elements:
                clean_text = clean_text_for_tts(el.get_text())
                if not clean_text:
                    continue

                sentences = re.split(r'(?<=[.!?])\s+', clean_text)

                for s in sentences:
                    if len(s) > MAX_LIMIT_CHARS:
                        if current_buffer:
                            yield {"type": "chunk", "content": current_buffer.strip()}
                            current_buffer = ""

                        sub_parts = split_long_sentence(s, MAX_LIMIT_CHARS)
                        for part in sub_parts[:-1]:
                            yield {"type": "chunk", "content": part.strip()}
                        current_buffer = sub_parts[-1]
                        continue

                    if len(current_buffer) + len(s) + 1 <= MAX_LIMIT_CHARS:
                        current_buffer += (" " if current_buffer else "") + s

                        if len(current_buffer) >= MAX_LIMIT_CHARS - 20:
                            yield {"type": "chunk", "content": current_buffer.strip()}
                            current_buffer = ""
                    else:
                        if current_buffer:
                            yield {"type": "chunk", "content": current_buffer.strip()}
                        current_buffer = s

    if current_buffer:
        yield {"type": "chunk", "content": current_buffer.strip()}