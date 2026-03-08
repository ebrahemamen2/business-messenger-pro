import { Mic, Square } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import lamejs from 'lamejs';

interface VoiceRecorderProps {
  onRecordComplete: (file: File) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

const RECORDER_MIME_TYPES = [
  'audio/ogg;codecs=opus',
  'audio/webm;codecs=opus',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/webm',
] as const;

function floatTo16BitPCM(input: Float32Array) {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

async function transcodeBlobToMp3(blob: Blob): Promise<File> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioCtx();

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

    const sampleRate = audioBuffer.sampleRate;
    const channels = audioBuffer.numberOfChannels;
    const left = audioBuffer.getChannelData(0);

    let mono = left;
    if (channels > 1) {
      const right = audioBuffer.getChannelData(1);
      const mixed = new Float32Array(left.length);
      for (let i = 0; i < left.length; i++) mixed[i] = (left[i] + right[i]) / 2;
      mono = mixed;
    }

    const mp3Encoder = new lamejs.Mp3Encoder(1, sampleRate, 96);
    const blockSize = 1152;
    const mp3Bytes: number[] = [];

    for (let i = 0; i < samples.length; i += blockSize) {
      const chunk = samples.subarray(i, i + blockSize);
      const encoded = mp3Encoder.encodeBuffer(chunk);
      if (encoded.length > 0) mp3Bytes.push(...Array.from(encoded));
    }

    const end = mp3Encoder.flush();
    if (end.length > 0) mp3Bytes.push(...Array.from(end));

    const mp3Blob = new Blob([new Uint8Array(mp3Bytes)], { type: 'audio/mpeg' });
    return new File([mp3Blob], `voice-${Date.now()}.mp3`, { type: 'audio/mpeg' });
  } finally {
    await audioContext.close();
  }
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
      const supportedMime = RECORDER_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      if (!supportedMime) {
        onError?.('المتصفح لا يدعم تسجيل صوت متوافق، جرّب Chrome أو Edge.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: supportedMime });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());

        if (!chunksRef.current.some((chunk) => chunk.size > 0)) {
          onError?.('التسجيل كان قصير جدًا أو فارغ، جرّب مرة أخرى.');
          return;
        }

        try {
          const sourceBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || supportedMime });
          const mp3File = await transcodeBlobToMp3(sourceBlob);
          onRecordComplete(mp3File);
        } catch {
          onError?.('فشل تحويل الفويس لصيغة متوافقة، جرّب متصفح آخر.');
        }
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
