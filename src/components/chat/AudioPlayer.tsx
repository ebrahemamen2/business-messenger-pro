import { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import { Play, Pause, Mic } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  isAgent?: boolean;
}

// Generate pseudo-random waveform heights (deterministic based on src)
const generateWaveform = (src: string, bars: number = 40): number[] => {
  let hash = 0;
  for (let i = 0; i < src.length; i++) {
    hash = ((hash << 5) - hash) + src.charCodeAt(i);
    hash |= 0;
  }

  const heights: number[] = [];
  for (let i = 0; i < bars; i++) {
    const seed = Math.sin(hash * (i + 1)) * 10000;
    const normalized = Math.abs(seed - Math.floor(seed));
    const baseHeight = 0.2 + normalized * 0.8;
    const wave = Math.sin(i * 0.3) * 0.2 + 0.8;
    heights.push(Math.min(1, baseHeight * wave));
  }
  return heights;
};

const formatTime = (seconds: number): string => {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const AudioPlayer = forwardRef<HTMLDivElement, AudioPlayerProps>(({ src, isAgent = false }, ref) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [waveformHeights] = useState(() => generateWaveform(src, 40));

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoaded(true);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  }, [isPlaying]);

  const handleWaveformClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const waveform = waveformRef.current;
    if (!audio || !waveform || !duration) return;

    const rect = waveform.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    audio.currentTime = Math.max(0, Math.min(duration, newTime));
    setCurrentTime(audio.currentTime);
  }, [duration]);

  const playedColor = isAgent ? 'bg-primary-foreground' : 'bg-primary';
  const unplayedColor = isAgent ? 'bg-primary-foreground/40' : 'bg-muted-foreground/30';
  const buttonBg = isAgent ? 'bg-primary-foreground/20 hover:bg-primary-foreground/30' : 'bg-primary/15 hover:bg-primary/25';
  const buttonIcon = isAgent ? 'text-primary-foreground' : 'text-primary';
  const textColor = isAgent ? 'text-primary-foreground/70' : 'text-muted-foreground';

  return (
    <div ref={ref} className="flex items-center gap-3 min-w-[240px] max-w-[300px] select-none">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />

      <button
        onClick={togglePlay}
        className={`w-11 h-11 rounded-full ${buttonBg} flex items-center justify-center flex-shrink-0 transition-all duration-200 active:scale-95`}
      >
        {isPlaying ? (
          <Pause className={`w-5 h-5 ${buttonIcon}`} fill="currentColor" />
        ) : (
          <Play className={`w-5 h-5 ${buttonIcon} ml-0.5`} fill="currentColor" />
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1.5">
        <div
          ref={waveformRef}
          onClick={handleWaveformClick}
          className="relative h-8 flex items-center gap-[2px] cursor-pointer group"
        >
          {waveformHeights.map((height, i) => {
            const barProgress = (i / waveformHeights.length) * 100;
            const isPlayed = barProgress < progress;

            return (
              <div
                key={i}
                className={`flex-1 rounded-full transition-all duration-100 ${
                  isPlayed ? playedColor : unplayedColor
                } group-hover:opacity-80`}
                style={{
                  height: `${Math.max(20, height * 100)}%`,
                  minWidth: '2px',
                  maxWidth: '4px',
                }}
              />
            );
          })}

          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ left: `${progress}%`, marginLeft: '-6px' }}
          />
        </div>

        <div className="flex items-center justify-between px-0.5">
          <span className={`text-[11px] font-medium ${textColor} tabular-nums`}>
            {isPlaying || currentTime > 0 ? formatTime(currentTime) : formatTime(duration)}
          </span>
          <div className="flex items-center gap-1.5">
            {isLoaded && (isPlaying || currentTime > 0) && (
              <span className={`text-[10px] ${textColor}`}>
                {formatTime(duration)}
              </span>
            )}
            <Mic className={`w-3.5 h-3.5 ${textColor}`} />
          </div>
        </div>
      </div>
    </div>
  );
});

AudioPlayer.displayName = 'AudioPlayer';

export default AudioPlayer;
