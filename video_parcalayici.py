import subprocess
import os


class AudioCutter:
    def __init__(self, source_path, output_dir):
        self.source_path = source_path
        self.output_dir = output_dir

        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)
            print(f" Klasör oluşturuldu: {self.output_dir}")

    def cut_segment(self, start_time, duration, emotion_name):
        output_name = f"mert_{emotion_name}.wav"
        output_path = os.path.join(self.output_dir, output_name)

        command = [
            'ffmpeg', '-y',
            '-err_detect', 'ignore_err',
            '-ss', str(start_time),
            '-i', self.source_path,
            '-t', str(duration),
            '-ar', '22050',
            '-ac', '1',
            '-af', 'aresample=async=1',
            '-c:a', 'pcm_s16le',
            output_path
        ]

        try:
            subprocess.run(command, check=True)

            if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                print(f" Başarılı: {emotion_name.capitalize()} ({os.path.getsize(output_path)} bytes)")
            else:
                print(f" Kritik Hata: {output_name} oluşturuldu ama dosya BOŞ (0 KB)!")
        except subprocess.CalledProcessError as e:
            print(f" FFmpeg hatası: {e}")


if __name__ == "__main__":
    source_file = r"C:\Users\EXCALIBUR\Desktop\seslik-V3\bb838179947f3bd49bd821ae38ee5557Kurk_Mantolu_Madonna.wav"
    target_dir = r"C:\Users\EXCALIBUR\Desktop\seslik-V3\EBookReaderFullStack\ReaderAudioAPI\app\speakers"

    cutter = AudioCutter(source_file, target_dir)

    segments = [
        {"start": "00:01:37", "dur": "15", "emotion": "excited"},
        {"start": "00:02:57", "dur": "15", "emotion": "happy"},
        {"start": "00:00:36", "dur": "15", "emotion": "sad"},
        {"start": "00:00:40", "dur": "15", "emotion": "neutral"}
    ]

    print(f"--- Operasyon Yeniden Başladı: {target_dir} ---")
    for seg in segments:
        cutter.cut_segment(seg["start"], seg["dur"], seg["emotion"])
    print("--- Kontrol tamamlandı! ---")