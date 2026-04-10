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

  playHallucinationDrift(intensity: number) {
    const clampedIntensity = Math.max(0, Math.min(1, intensity));
    const baseFrequency = 320 + clampedIntensity * 120;
    const detunedFrequency = baseFrequency * (1.012 + clampedIntensity * 0.016);
    const baseVolume = 0.018 + clampedIntensity * 0.03;

    this.playBeep(
      baseFrequency,
      "sine",
      0.08 + clampedIntensity * 0.04,
      baseVolume,
    );
    setTimeout(() => {
      this.playBeep(
        detunedFrequency,
        "triangle",
        0.06 + clampedIntensity * 0.03,
        baseVolume * 0.7,
      );
    }, 28);
  }

  playConnectionWarning(
    intensity: number,
    stage: "warning" | "critical" | "imminent",
  ) {
    const clampedIntensity = Math.max(0, Math.min(1, intensity));
    const baseFrequency =
      (stage === "warning" ? 920 : stage === "critical" ? 1140 : 1440) +
      clampedIntensity * 140;
    const baseDuration =
      (stage === "imminent" ? 0.022 : 0.03) + clampedIntensity * 0.018;
    const baseVolume =
      (stage === "warning" ? 0.018 : stage === "critical" ? 0.028 : 0.04) +
      clampedIntensity * 0.02;

    this.playBeep(baseFrequency, "square", baseDuration, baseVolume);
    setTimeout(
      () => {
        this.playBeep(
          baseFrequency * (stage === "imminent" ? 1.21 : 1.11),
          stage === "warning" ? "triangle" : "sine",
          Math.max(0.015, baseDuration * 0.72),
          baseVolume * 0.65,
        );
      },
      stage === "imminent" ? 18 : 24,
    );
  }
}

export const synth = new SoundSynth();
