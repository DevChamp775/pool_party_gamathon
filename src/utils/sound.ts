class ArcadeAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  public setMuted(m: boolean) {
    this.muted = m;
  }

  public isMuted() {
    return this.muted;
  }

  private getCtx(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'square', gainVal = 0.06, delay = 0) {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  public playCoinLock() {
    this.playTone(587.33, 0.08, 'square', 0.05, 0);
    this.playTone(880, 0.14, 'square', 0.05, 0.07);
  }

  public playTick() {
    this.playTone(440, 0.04, 'triangle', 0.035, 0);
  }

  public playSplashReveal() {
    this.playTone(392, 0.1, 'triangle', 0.06, 0);
    this.playTone(523.25, 0.1, 'triangle', 0.06, 0.09);
    this.playTone(659.25, 0.12, 'triangle', 0.06, 0.18);
    this.playTone(783.99, 0.22, 'square', 0.05, 0.28);
  }

  public playFanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => this.playTone(n, 0.18, 'square', 0.05, i * 0.11));
  }
}

export const arcadeSfx = new ArcadeAudioEngine();
