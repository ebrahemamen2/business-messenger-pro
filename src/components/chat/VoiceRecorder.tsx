import { Mic, Square } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface VoiceRecorderProps {
  onRecordComplete: (file: File) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

const WHATSAPP_AUDIO_MIME_TYPES = [
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/aac',
  'audio/mpeg',
  'audio/amr',
] as const;

function mimeToExt(mimeType: string) {
  if (mimeType.startsWith('audio/ogg')) return 'ogg';
  if (mimeType.startsWith('audio/mp4')) return 'mp4';
  if (mimeType.startsWith('audio/aac')) return 'aac';
  if (mimeType.startsWith('audio/mpeg')) return 'mp3';
  if (mimeType.startsWith('audio/amr')) return 'amr';
  return 'audio';
}

const VoiceRecorder = ({ onRecordComplete, onError, disabled }: VoiceRecorderProps) => {
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
      const supportedMime = WHATSAPP_AUDIO_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      if (!supportedMime) {
        onError?.('متصفحك لا يدعم تسجيل فويس بصيغة متوافقة مع واتساب، جرّب متصفح/جهاز آخر.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: supportedMime });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());

        const actualMime = (chunksRef.current.find((c) => c.size > 0)?.type || mediaRecorder.mimeType || supportedMime).toLowerCase();
        const normalizedMime = actualMime.replace(/\s+/g, '');
        const isSupported = WHATSAPP_AUDIO_MIME_TYPES.some((type) => normalizedMime.startsWith(type.replace(/\s+/g, '')));

        if (!isSupported) {
          onError?.('نوع الصوت الناتج غير مدعوم من واتساب، جرّب تسجيل أطول أو متصفح آخر.');
          return;
        }

        const blob = new Blob(chunksRef.current, { type: actualMime });
        const file = new File([blob], `voice-${Date.now()}.${mimeToExt(actualMime)}`, { type: actualMime });
        onRecordComplete(file);
      };

      mediaRecorder.start(100);
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      onError?.('تعذّر الوصول للمايكروفون. تأكد من السماح بالوصول ثم حاول مرة أخرى.');
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
