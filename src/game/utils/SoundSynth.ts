export class SoundSynth {
  private ctx: AudioContext | null = null;

  constructor() {
    try {
      this.ctx = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
    } catch (e) {
      console.warn("Web Audio API not supported");
    }
  }

  private ensureContext() {
    if (!this.ctx) return false;
    if (this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => undefined);
    }
    return true;
  }

  playBeep(
    freq: number,
    type: OscillatorType,
    duration: number,
    vol: number = 0.1,
  ) {
    if (!this.ensureContext() || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.01,
      this.ctx.currentTime + duration,
    );

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playTypewriter() {
    this.playBeep(800 + Math.random() * 200, "square", 0.05, 0.05);
  }

  playDiskInsert() {
    this.playDriveInsert();
  }

  playDriveInsert() {
    this.playBeep(240, "square", 0.03, 0.14);
    setTimeout(() => this.playBeep(130, "triangle", 0.09, 0.08), 35);
    setTimeout(() => this.playBeep(880, "sine", 0.05, 0.04), 110);
  }

  playButtonPress() {
    this.playBeep(300, "square", 0.1, 0.1);
  }

  playError() {
    this.playBeep(100, "sawtooth", 0.5, 0.2);
    setTimeout(() => this.playBeep(80, "sawtooth", 0.5, 0.2), 150);
  }

  playSuccess() {
    this.playBeep(400, "sine", 0.1, 0.1);
    setTimeout(() => this.playBeep(600, "sine", 0.2, 0.1), 100);
  }

  playThermalStress(intensity: number, isOverheated: boolean) {
    const clampedIntensity = Math.max(0, Math.min(1, intensity));
    const baseFrequency = 86 + clampedIntensity * 52;
    const baseVolume = 0.025 + clampedIntensity * 0.045;
    const baseDuration = 0.07 + clampedIntensity * 0.06;

    this.playBeep(baseFrequency, "sawtooth", baseDuration, baseVolume);
    setTimeout(() => {
      this.playBeep(
        baseFrequency * (isOverheated ? 1.9 : 1.45),
        isOverheated ? "square" : "triangle",
        0.03 + clampedIntensity * 0.04,
        baseVolume * (isOverheated ? 0.95 : 0.65),
      );
    }, 38);

    if (isOverheated) {
      setTimeout(() => {
        this.playBeep(
          baseFrequency * 0.78,
          "sawtooth",
          0.08 + clampedIntensity * 0.04,
          baseVolume * 0.85,
        );
      }, 92);
    }
  }
}

export const synth = new SoundSynth();
