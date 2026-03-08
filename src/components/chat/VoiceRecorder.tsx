import { Mic, Square, Loader2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface VoiceRecorderProps {
  onRecordComplete: (file: File) => void;
  disabled?: boolean;
}

const VoiceRecorder = ({ onRecordComplete, disabled }: VoiceRecorderProps) => {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Prefer ogg/opus (WhatsApp native), fallback to mp4, then webm
      let mimeType = 'audio/webm;codecs=opus';
      if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        // Always output as ogg for WhatsApp compatibility
        const isOgg = mimeType.includes('ogg');
        const isMp4 = mimeType.includes('mp4');
        const outputType = isOgg ? 'audio/ogg' : isMp4 ? 'audio/mp4' : 'audio/ogg';
        const ext = isOgg ? 'ogg' : isMp4 ? 'mp4' : 'ogg';
        const blob = new Blob(chunksRef.current, { type: outputType });
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: outputType });
        onRecordComplete(file);
      };

      mediaRecorder.start(100);
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      // Permission denied or no mic
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (recording) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-destructive font-medium animate-pulse">● {formatDuration(duration)}</span>
        <button
          onClick={stopRecording}
          className="p-2.5 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all"
        >
          <Square className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startRecording}
      disabled={disabled}
      className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary mb-0.5 disabled:opacity-40"
      title="تسجيل صوتي"
    >
      <Mic className="w-5 h-5" />
    </button>
  );
};

export default VoiceRecorder;
