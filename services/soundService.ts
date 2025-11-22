let audioCtx: AudioContext | null = null;

const getCtx = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
};

export type SoundEffect = 'FLIP' | 'CORRECT' | 'WRONG' | 'WIN' | 'LOSE';

const playTone = (ctx: AudioContext, freq: number, type: OscillatorType, startTime: number, duration: number, volume: number = 0.1) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  
  osc.start(startTime);
  osc.stop(startTime + duration);
};

export const playSound = (effect: SoundEffect) => {
  try {
    const ctx = getCtx();
    // Browsers require user interaction to resume audio context
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    switch (effect) {
      case 'FLIP':
        // Short high pop/click
        playTone(ctx, 600, 'sine', now, 0.1, 0.05);
        break;

      case 'CORRECT':
        // High pleasant ding (A5)
        playTone(ctx, 880, 'sine', now, 0.6, 0.1);
        // Slight overtone
        playTone(ctx, 1760, 'sine', now, 0.3, 0.02);
        break;

      case 'WRONG':
        // Low thud/buzz
        const wOsc = ctx.createOscillator();
        const wGain = ctx.createGain();
        wOsc.type = 'triangle';
        wOsc.frequency.setValueAtTime(150, now);
        wOsc.frequency.linearRampToValueAtTime(100, now + 0.3);
        
        wOsc.connect(wGain);
        wGain.connect(ctx.destination);
        
        wGain.gain.setValueAtTime(0.15, now);
        wGain.gain.linearRampToValueAtTime(0.001, now + 0.3);
        
        wOsc.start(now);
        wOsc.stop(now + 0.3);
        break;

      case 'WIN':
        // Major Chord (C Major: C5, E5, G5)
        playTone(ctx, 523.25, 'sine', now, 0.8, 0.1);       // C
        playTone(ctx, 659.25, 'sine', now + 0.1, 0.8, 0.1); // E
        playTone(ctx, 783.99, 'sine', now + 0.2, 1.2, 0.1); // G
        break;

      case 'LOSE':
        // Dissonant / Explosion simulation
        const lOsc = ctx.createOscillator();
        const lGain = ctx.createGain();
        lOsc.type = 'sawtooth';
        lOsc.frequency.setValueAtTime(100, now);
        lOsc.frequency.exponentialRampToValueAtTime(30, now + 1.0);
        
        lOsc.connect(lGain);
        lGain.connect(ctx.destination);
        
        lGain.gain.setValueAtTime(0.2, now);
        lGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
        
        lOsc.start(now);
        lOsc.stop(now + 1.0);
        break;
    }
  } catch (e) {
    console.error("Audio playback failed", e);
  }
};
