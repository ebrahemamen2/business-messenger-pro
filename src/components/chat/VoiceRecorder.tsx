import { Mic, Square } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface VoiceRecorderProps {
  onRecordComplete: (file: File) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

const AUDIO_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/webm',
  'audio/ogg',
];

const getSupportedMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  return AUDIO_MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) || '';
};

const floatTo16BitPCM = (input: Float32Array) => {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
};

const encodeMp3FromInt16 = async (samples: Int16Array, sampleRate: number) => {
  const lameModule = await import('lamejs');
  const Mp3Encoder = (lameModule as any).Mp3Encoder || (lameModule as any).default?.Mp3Encoder;

  if (!Mp3Encoder) throw new Error('Mp3Encoder unavailable');

  const encoder = new Mp3Encoder(1, Math.round(sampleRate), 96);
  const blockSize = 1152;
  const mp3Bytes: number[] = [];

  for (let i = 0; i < samples.length; i += blockSize) {
    const block = samples.subarray(i, i + blockSize);
    const encoded = encoder.encodeBuffer(block) as Int8Array;
    if (encoded?.length) mp3Bytes.push(...Array.from(encoded));
  }

  const end = encoder.flush() as Int8Array;
  if (end?.length) mp3Bytes.push(...Array.from(end));

  return new Blob([new Uint8Array(mp3Bytes)], { type: 'audio/mpeg' });
};

const transcodeToMp3 = async (blob: Blob): Promise<File> => {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) throw new Error('AudioContext unavailable');

  const audioContext: AudioContext = new AudioCtx();

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

    const channelCount = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const monoData = new Float32Array(length);

    for (let ch = 0; ch < channelCount; ch++) {
      const channel = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        monoData[i] += channel[i] / channelCount;
      }
    }

    const pcm16 = floatTo16BitPCM(monoData);
    const mp3Blob = await encodeMp3FromInt16(pcm16, audioBuffer.sampleRate);

    if (mp3Blob.size < 1024) throw new Error('Encoded MP3 too small');

    return new File([mp3Blob], `voice-${Date.now()}.mp3`, { type: 'audio/mpeg' });
  } finally {
    await audioContext.close().catch(() => undefined);
  }
};

const fileExtensionByMime = (mimeType: string) => {
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('webm')) return 'webm';
  return 'dat';
};

const VoiceRecorder = ({ onRecordComplete, onError, disabled }: VoiceRecorderProps) => {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state !== 'inactive') {
        mediaRecorderRef.current?.stop();
      }
      cleanupStream();
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mimeType = getSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      recordedChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) recordedChunksRef.current.push(event.data);
      };

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

    recorder.onstop = async () => {
      try {
        const mimeType = recorder.mimeType || 'audio/webm';
        const rawBlob = new Blob(recordedChunksRef.current, { type: mimeType });

        if (rawBlob.size < 1024) {
          onError?.('التسجيل كان قصير جدًا أو فارغ، جرّب مرة أخرى.');
          return;
        }

        // Primary path: MP3 for best delivery compatibility.
        try {
          const mp3File = await transcodeToMp3(rawBlob);
          onRecordComplete(mp3File);
          return;
        } catch (mp3Error) {
          console.error('MP3 transcode failed, fallback to raw audio:', mp3Error);
        }

        // Fallback path: keep user flow working even if transcoding fails.
        const ext = fileExtensionByMime(mimeType);
        const fallbackFile = new File([rawBlob], `voice-${Date.now()}.${ext}`, { type: mimeType });
        onRecordComplete(fallbackFile);
      } catch (error) {
        console.error('Voice prepare failed:', error);
        onError?.('فشل تجهيز الفويس للإرسال، جرّب مرة أخرى.');
      } finally {
        recordedChunksRef.current = [];
        mediaRecorderRef.current = null;
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
