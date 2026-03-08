import { Mic, Square } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import lamejs from 'lamejs';

interface VoiceRecorderProps {
  onRecordComplete: (file: File) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

function mergeFloat32Chunks(chunks: Float32Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

function floatTo16BitPCM(input: Float32Array) {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

function encodeMp3FromPcm(samples: Int16Array, sampleRate: number): Uint8Array {
  const mp3Encoder = new lamejs.Mp3Encoder(1, sampleRate, 96);
  const blockSize = 1152;
  const mp3Bytes: number[] = [];

  for (let i = 0; i < samples.length; i += blockSize) {
    const chunk = samples.subarray(i, i + blockSize);
    const encoded = mp3Encoder.encodeBuffer(chunk) as Int8Array;
    if (encoded.length > 0) mp3Bytes.push(...(Array.from(encoded) as number[]));
  }

  const end = mp3Encoder.flush() as Int8Array;
  if (end.length > 0) mp3Bytes.push(...(Array.from(end) as number[]));

  return new Uint8Array(mp3Bytes);
}

const VoiceRecorder = ({ onRecordComplete, onError, disabled }: VoiceRecorderProps) => {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);

  const cleanupAudio = async () => {
    processorNodeRef.current?.disconnect();
    sourceNodeRef.current?.disconnect();

    processorNodeRef.current = null;
    sourceNodeRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (audioContextRef.current) {
      await audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      cleanupAudio();
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext: AudioContext = new AudioCtx();
      await audioContext.resume();

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      pcmChunksRef.current = [];

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        pcmChunksRef.current.push(new Float32Array(input));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      sourceNodeRef.current = source;
      processorNodeRef.current = processor;

      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      onError?.('تعذّر الوصول للمايكروفون. تأكد من السماح بالوصول ثم حاول مرة أخرى.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const sampleRate = audioContextRef.current?.sampleRate || 44100;
      const merged = mergeFloat32Chunks(pcmChunksRef.current);

      await cleanupAudio();

      if (merged.length < 2048) {
        onError?.('التسجيل كان قصير جدًا أو فارغ، جرّب مرة أخرى.');
        return;
      }

      const pcm16 = floatTo16BitPCM(merged);
      const mp3Bytes = encodeMp3FromPcm(pcm16, sampleRate);
      const mp3Blob = new Blob([mp3Bytes], { type: 'audio/mpeg' });
      const mp3File = new File([mp3Blob], `voice-${Date.now()}.mp3`, { type: 'audio/mpeg' });

      onRecordComplete(mp3File);
    } catch {
      onError?.('فشل تجهيز الفويس للإرسال، جرّب مرة أخرى.');
    } finally {
      pcmChunksRef.current = [];
    }
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
