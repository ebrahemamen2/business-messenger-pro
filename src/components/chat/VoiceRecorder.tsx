import { Mic, Square } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface VoiceRecorderProps {
  onRecordComplete: (file: File) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

const SUPPORTED_MIME_TYPES = [
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
];

function getSupportedMimeType(): string {
  for (const mime of SUPPORTED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return '';
}

// Map browser mime type → what we tell WhatsApp API
function toWhatsAppMime(mime: string): string {
  const base = mime.split(';')[0].trim();
  if (base === 'audio/ogg') return 'audio/ogg';
  if (base === 'audio/mp4') return 'audio/mp4';
  // audio/webm → we send as audio/ogg, WhatsApp accepts it
  return 'audio/ogg';
}

const VoiceRecorder = ({ onRecordComplete, onError, disabled }: VoiceRecorderProps) => {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      if (!mimeType) {
        onError?.('المتصفح لا يدعم تسجيل الصوت. استخدم Chrome أو Firefox.');
        return;
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });

        if (blob.size < 1000) {
          onError?.('التسجيل كان قصير جداً أو فارغ، جرّب مرة أخرى.');
          return;
        }

        // Always name it .ogg and tell the API audio/ogg
        const whatsappMime = toWhatsAppMime(mimeType);
        const ext = whatsappMime === 'audio/mp4' ? 'm4a' : 'ogg';
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: whatsappMime });
        onRecordComplete(file);
      };

      recorder.start(250); // collect chunks every 250ms
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch {
      onError?.('تعذّر الوصول للمايكروفون. تأكد من السماح بالوصول ثم حاول مرة أخرى.');
    }
  };

  const stopRecording = () => {
    if (!recording || !mediaRecorderRef.current) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current = null;
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
