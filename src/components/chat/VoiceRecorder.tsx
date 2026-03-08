import { Mic, Square } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface VoiceRecorderProps {
  onRecordComplete: (file: File) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

const getPreferredMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) return 'audio/ogg;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  return '';
};

const getFileExtension = (mimeType: string) => {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes('ogg')) return 'ogg';
  if (normalized.includes('mp4')) return 'm4a';
  if (normalized.includes('webm')) return 'webm';
  return 'dat';
};

const VoiceRecorder = ({ onRecordComplete, onError, disabled }: VoiceRecorderProps) => {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const selectedMimeTypeRef = useRef<string>('');
  const recordedChunksRef = useRef<BlobPart[]>([]);

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      cleanupStream();
    };
  }, []);

  const startRecording = async () => {
    try {
      // Must stay directly inside user click handler for browser permissions.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const preferredMimeType = getPreferredMimeType();
      if (preferredMimeType !== 'audio/ogg;codecs=opus') {
        stream.getTracks().forEach((track) => track.stop());
        onError?.('المتصفح الحالي لا يوفّر تسجيل OGG Opus المطلوب للإرسال الموثوق. استخدم Chrome أو Edge.');
        return;
      }

      const recorder = new MediaRecorder(stream, { mimeType: preferredMimeType });


      streamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.start(250);
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      onError?.('تعذّر الوصول للمايكروفون. تأكد من السماح بالوصول ثم حاول مرة أخرى.');
    }
  };

  const stopRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);

    recorder.onstop = () => {
      try {
        const mimeType = recorder.mimeType || selectedMimeTypeRef.current || 'audio/webm';
        const rawBlob = new Blob(recordedChunksRef.current, { type: mimeType });

        if (rawBlob.size < 1024) {
          onError?.('التسجيل كان قصير جدًا أو فارغ، جرّب مرة أخرى.');
          return;
        }

        const ext = getFileExtension(mimeType);
        const voiceFile = new File([rawBlob], `voice-${Date.now()}.${ext}`, { type: mimeType });
        onRecordComplete(voiceFile);
      } catch (error) {
        console.error('Voice prepare failed:', error);
        onError?.('فشل تجهيز الفويس للإرسال، جرّب مرة أخرى.');
      } finally {
        recordedChunksRef.current = [];
        mediaRecorderRef.current = null;
        selectedMimeTypeRef.current = '';
        cleanupStream();
      }
    };

    recorder.stop();
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
