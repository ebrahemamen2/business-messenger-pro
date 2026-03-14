// Generate notification sound using Web Audio API (no external file needed)
let audioCtx: AudioContext | null = null;

export function playNotificationSound() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const ctx = audioCtx;
    const now = ctx.currentTime;

    // Create a pleasant two-tone notification
    const oscillator1 = ctx.createOscillator();
    const oscillator2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator1.type = 'sine';
    oscillator1.frequency.setValueAtTime(830, now);
    oscillator1.frequency.setValueAtTime(990, now + 0.1);

    oscillator2.type = 'sine';
    oscillator2.frequency.setValueAtTime(630, now);
    oscillator2.frequency.setValueAtTime(790, now + 0.1);

    gainNode.gain.setValueAtTime(0.15, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator1.start(now);
    oscillator2.start(now);
    oscillator1.stop(now + 0.3);
    oscillator2.stop(now + 0.3);
  } catch {
    // Silently fail if audio is not available
  }
}
