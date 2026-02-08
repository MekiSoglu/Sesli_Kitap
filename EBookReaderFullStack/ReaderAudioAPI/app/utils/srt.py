from datetime import timedelta

def format_ts(seconds: float) -> str:
    ms = int((seconds - int(seconds)) * 1000)
    total = int(seconds)
    h = total // 3600
    m = (total % 3600) // 60
    s = total % 60
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def generate_sentence_srt(chunks):
    """
    Chunk bazlı SRT üretir
    Her chunk ekranda tek parça gösterilir
    """
    srt = []
    cursor = 0.0
    idx = 1

    for c in chunks:
        dur = c.duration or (len(c.text.split()) * 0.45)
        start = cursor
        end = cursor + dur

        srt.append(
            f"{idx}\n"
            f"{format_ts(start)} --> {format_ts(end)}\n"
            f"{c.text}\n"
        )

        cursor = end
        idx += 1

    return "\n".join(srt), cursor
