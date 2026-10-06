// All sound and music are original Web Audio synthesis; no downloaded samples.
export class Soundscape {
  constructor(settings) {
    this.settings = settings;
    this.context = null;
    this.timer = null;
    this.step = 0;
  }
  async start() {
    clearTimeout(this.pendingSuspend);
    if (!this.context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      this.context = new Audio();
      this.music = this.context.createGain();
      this.effects = this.context.createGain();
      this.music.connect(this.context.destination);
      this.effects.connect(this.context.destination);
    }
    await this.context.resume();
    this.apply();
    if (!this.timer) this.timer = setInterval(() => this.ambient(), 1500);
  }
  apply() {
    if (!this.context) return;
    this.music.gain.setTargetAtTime(
      this.settings.music * 0.075,
      this.context.currentTime,
      0.15,
    );
    this.effects.gain.setTargetAtTime(
      this.settings.effects * 0.15,
      this.context.currentTime,
      0.1,
    );
  }
  note(
    freq,
    duration,
    type = "sine",
    bus = this.effects,
    volume = 0.5,
    delay = 0,
    endFreq = freq,
  ) {
    if (!this.context || this.context.state !== "running") return;
    const t = this.context.currentTime + delay,
      o = this.context.createOscillator(),
      g = this.context.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(
      Math.max(20, endFreq),
      t + duration,
    );
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + duration + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  ambient() {
    const notes = [110, 130.81, 146.83, 98];
    this.note(
      notes[Math.floor(this.step / 4) % 4],
      2.9,
      "sine",
      this.music,
      0.5,
    );
    if (this.step % 2 === 0)
      this.note(
        notes[this.step % 4] * 2,
        2.5,
        "triangle",
        this.music,
        0.13,
        0.3,
      );
    this.step++;
  }
  play(event) {
    if (!this.context) return;
    switch (event) {
      case "gun":
        this.note(85, 0.13, "sawtooth", this.effects, 0.65, 0, 25);
        break;
      case "sword":
        this.note(320, 0.17, "triangle", this.effects, 0.6, 0, 80);
        break;
      case "bow":
        this.note(550, 0.12, "triangle", this.effects, 0.45, 0, 100);
        break;
      case "hit":
        this.note(140, 0.1, "square", this.effects, 0.25, 0, 45);
        break;
      case "hurt":
        this.note(95, 0.25, "sawtooth", this.effects, 0.5, 0, 35);
        break;
      case "capture":
      case "evolve":
      case "craft":
      case "collect":
        [330, 440, 660].forEach((f, i) =>
          this.note(f, 0.2, "sine", this.effects, 0.25, i * 0.08),
        );
        break;
      case "horde":
        this.note(65, 1, "sawtooth", this.effects, 0.4);
        this.note(73.42, 1, "sine", this.effects, 0.3, 0.4);
        break;
      default:
        this.note(440, 0.06, "sine", this.effects, 0.2);
    }
  }
  suspend() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.context) {
      this.music.gain.setTargetAtTime(0, this.context.currentTime, 0.05);
      this.effects.gain.setTargetAtTime(0, this.context.currentTime, 0.05);
      this.pendingSuspend = setTimeout(
        () => this.context?.suspend().catch(() => {}),
        220,
      );
    }
  }
}
