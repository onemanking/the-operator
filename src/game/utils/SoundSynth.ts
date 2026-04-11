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
      (stage === "warning" ? 520 : stage === "critical" ? 680 : 860) +
      clampedIntensity * 110;
    const baseDuration =
      (stage === "imminent" ? 0.02 : 0.028) + clampedIntensity * 0.016;
    const baseVolume =
      (stage === "warning" ? 0.02 : stage === "critical" ? 0.03 : 0.042) +
      clampedIntensity * 0.018;

    this.playBeep(baseFrequency, "triangle", baseDuration, baseVolume);
    setTimeout(
      () => {
        this.playBeep(
          baseFrequency * (stage === "imminent" ? 1.85 : 1.6),
          "sine",
          Math.max(0.012, baseDuration * 0.55),
          baseVolume * 0.52,
        );
      },
      stage === "imminent" ? 14 : 20,
    );

    if (stage !== "warning") {
      setTimeout(
        () => {
          this.playBeep(
            baseFrequency * 0.76,
            "triangle",
            Math.max(0.012, baseDuration * 0.45),
            baseVolume * 0.32,
          );
        },
        stage === "imminent" ? 34 : 46,
      );
    }
  }

  playUtilityArm(
    utilityId: "coolant_purge" | "reality_patch" | "signal_boost",
  ) {
    if (utilityId === "coolant_purge") {
      this.playBeep(124, "square", 0.04, 0.08);
      setTimeout(() => this.playBeep(82, "sawtooth", 0.08, 0.07), 28);
      return;
    }

    if (utilityId === "reality_patch") {
      this.playBeep(260, "sine", 0.05, 0.06);
      setTimeout(() => this.playBeep(360, "triangle", 0.06, 0.05), 32);
      setTimeout(() => this.playBeep(470, "sine", 0.08, 0.04), 70);
      return;
    }

    this.playBeep(1480, "triangle", 0.01, 0.04);
    setTimeout(() => this.playBeep(210, "sine", 0.06, 0.03), 18);
  }

  playUtilityFail(
    utilityId: "coolant_purge" | "reality_patch" | "signal_boost",
  ) {
    if (utilityId === "coolant_purge") {
      this.playBeep(150, "sawtooth", 0.12, 0.12);
      setTimeout(() => this.playBeep(198, "sawtooth", 0.08, 0.1), 36);
      setTimeout(() => this.playBeep(116, "triangle", 0.1, 0.07), 74);
      return;
    }

    if (utilityId === "reality_patch") {
      this.playBeep(118, "square", 0.14, 0.09);
      setTimeout(() => this.playBeep(112, "square", 0.12, 0.08), 18);
      return;
    }

    this.playBeep(360, "sawtooth", 0.05, 0.07);
    setTimeout(() => this.playBeep(240, "sawtooth", 0.07, 0.07), 34);
    setTimeout(() => this.playBeep(162, "triangle", 0.08, 0.06), 72);
  }

  playUtilitySuccess(
    utilityId: "coolant_purge" | "reality_patch" | "signal_boost",
  ) {
    if (utilityId === "coolant_purge") {
      this.playBeep(420, "triangle", 0.06, 0.07);
      setTimeout(() => this.playBeep(220, "triangle", 0.08, 0.08), 44);
      setTimeout(() => this.playBeep(88, "sawtooth", 0.16, 0.09), 98);
      return;
    }

    if (utilityId === "reality_patch") {
      this.playBeep(440, "sine", 0.1, 0.06);
      this.playBeep(554, "sine", 0.1, 0.05);
      setTimeout(() => this.playBeep(659, "triangle", 0.14, 0.05), 34);
      return;
    }

    this.playBeep(800, "sine", 0.05, 0.06);
    setTimeout(() => this.playBeep(1000, "sine", 0.05, 0.06), 34);
    setTimeout(() => this.playBeep(1220, "triangle", 0.08, 0.05), 72);
  }

  playCoolantPurgeLoop(intensity: number) {
    const clampedIntensity = Math.max(0, Math.min(1, intensity));
    this.playBeep(
      740 + clampedIntensity * 280,
      "sawtooth",
      0.02,
      0.012 + clampedIntensity * 0.018,
    );
  }

  playCoolantPurgeLatch() {
    this.playBeep(380, "triangle", 0.05, 0.07);
    setTimeout(() => this.playBeep(160, "square", 0.08, 0.05), 28);
  }

  playRealityPatchAdjust(matchRatio: number) {
    const clampedMatchRatio = Math.max(0, Math.min(1, matchRatio));
    this.playBeep(
      600 + clampedMatchRatio * 540,
      "sine",
      0.04,
      0.018 + clampedMatchRatio * 0.022,
    );
  }

  playSignalBoostNode(nodeCount: number) {
    this.playBeep(540 + nodeCount * 110, "square", 0.03, 0.045);
  }

  playSearchArm() {
    const baseFrequency = 340 + Math.random() * 30;
    this.playBeep(baseFrequency, "triangle", 0.03, 0.04);
    setTimeout(() => {
      this.playBeep(baseFrequency * 1.42, "sine", 0.05, 0.035);
    }, 26);
    setTimeout(() => {
      this.playBeep(baseFrequency * 1.92, "triangle", 0.06, 0.028);
    }, 64);
  }

  playSearchPulseLoop(cycleIndex: number) {
    const drift = Phaser.Math.Between(-12, 12);
    const baseFrequency = 214 + (cycleIndex % 4) * 18 + drift;
    this.playBeep(baseFrequency, "sine", 0.06, 0.018);
    setTimeout(() => {
      this.playBeep(baseFrequency * 1.86, "triangle", 0.025, 0.014);
    }, 36);
  }

  playSearchSuccess() {
    const baseFrequency = 980 + Math.random() * 40;
    this.playBeep(baseFrequency, "sine", 0.05, 0.05);
    setTimeout(() => {
      this.playBeep(baseFrequency * 1.28, "triangle", 0.08, 0.04);
    }, 38);
  }

  playSearchMiss() {
    const baseFrequency = 134 + Math.random() * 16;
    this.playBeep(baseFrequency, "sawtooth", 0.12, 0.05);
    setTimeout(() => {
      this.playBeep(baseFrequency * 0.84, "triangle", 0.09, 0.04);
    }, 52);
  }

  playSearchNoTarget() {
    const baseFrequency = 284 + Math.random() * 22;
    this.playBeep(baseFrequency, "triangle", 0.06, 0.028);
    setTimeout(() => {
      this.playBeep(baseFrequency * 0.72, "sine", 0.08, 0.022);
    }, 80);
  }
}

export const synth = new SoundSynth();
