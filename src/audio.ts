import { synthesizeVandalShot, VANDAL_SOUND } from './vandal-sound';

export class GunAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private shots: AudioBuffer[] = [];
  private recordedShots: AudioBuffer[] = [];
  private rawShots: ArrayBuffer[] = [];
  private preparation?: Promise<void>;
  private decoding?: Promise<void>;
  private impacts: AudioBuffer[] = [];
  private lastVariant = -1;
  private timeOrigin?: { simulation: number; audio: number };
  private sample?: AudioBuffer;
  get sourceName() { return this.recordedShots.length || this.rawShots.length ? '狂徒 · 参考录音' : '狂徒 · 合成'; }
  prepare() {
    return this.preparation ??= Promise.all([1, 2, 3].map(async index => {
      const response = await fetch(`${import.meta.env.BASE_URL}audio/vandal/shot-${index}.wav`, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Reference sound unavailable');
      return response.arrayBuffer();
    })).then(buffers => { this.rawShots = buffers; }).catch(() => { this.rawShots = []; });
  }
  private decodeReferences() {
    return this.decoding ??= this.prepare().then(async () => {
      this.recordedShots = await Promise.all(this.rawShots.map(data => this.context!.decodeAudioData(data.slice(0))));
    }).catch(() => { this.recordedShots = []; this.rawShots = []; });
  }
  async importSample(data: ArrayBuffer) {
    await this.init();
    const decoded = await this.context!.decodeAudioData(data);
    if (decoded.duration > 5) throw new Error('请选择不超过 5 秒的单发枪声');
    this.sample = decoded;
  }
  clearSample() { this.sample = undefined; }
  async init() {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: 'interactive' });
      this.master = this.context.createGain();
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -3; compressor.knee.value = 3; compressor.ratio.value = 12;
      compressor.attack.value = 0.001; compressor.release.value = 0.08;
      this.master.connect(compressor); compressor.connect(this.context.destination);
      for (let i = 0; i < VANDAL_SOUND.variants; i++) {
        const data = synthesizeVandalShot(this.context.sampleRate, 0x197762 + i * 7919);
        const buffer = this.context.createBuffer(1, data.length, this.context.sampleRate);
        buffer.getChannelData(0).set(data); this.shots.push(buffer);
      }
      this.impacts = [this.mechanical(0.045, 0.35), this.mechanical(0.07, 0.7)];
    }
    await Promise.all([this.context.resume(), this.decodeReferences()]);
  }
  volume(value: number) { if (this.master && this.context) this.master.gain.setTargetAtTime(value * 0.65, this.context.currentTime, 0.02); }
  private mechanical(duration: number, brightness: number) {
    const ctx = this.context!;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0); let low = 0;
    for (let i = 0; i < data.length; i++) {
      const noise = Math.random() * 2 - 1, t = i / ctx.sampleRate;
      low += (noise - low) * 0.13;
      data[i] = (low + (noise - low) * brightness) * Math.exp(-t / (duration / 6))
        * Math.min(1, t / 0.0005) * (1 - i / data.length);
    }
    return buffer;
  }
  private play(buffer: AudioBuffer, time: number, volume = 1) {
    const ctx = this.context!;
    const source = ctx.createBufferSource(), gain = ctx.createGain();
    source.buffer = buffer; gain.gain.value = volume;
    source.connect(gain); gain.connect(this.master!); source.start(time);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
  }
  shot(simulationTime?: number) {
    const ctx = this.context; if (!ctx || !this.master || !this.shots.length) return;
    let time = ctx.currentTime + 0.003;
    if (simulationTime !== undefined) {
      const scheduled = this.timeOrigin && this.timeOrigin.audio + simulationTime - this.timeOrigin.simulation;
      if (scheduled === undefined || scheduled < ctx.currentTime || scheduled > ctx.currentTime + 0.1) {
        this.timeOrigin = { simulation: simulationTime, audio: ctx.currentTime + 0.015 };
      }
      time = this.timeOrigin!.audio + simulationTime - this.timeOrigin!.simulation;
    }
    const variants = this.recordedShots.length ? this.recordedShots : this.shots;
    const variant = (this.lastVariant + 1 + Math.floor(Math.random() * (variants.length - 1))) % variants.length;
    this.lastVariant = variant; this.play(this.sample ?? variants[variant], time);
  }
  hit(head: boolean) {
    if (this.context && this.impacts.length) this.play(this.impacts[head ? 1 : 0], this.context.currentTime, 0.24);
  }
  flashCue(pop = false) {
    const ctx = this.context; if (!ctx || !this.master) return;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.frequency.setValueAtTime(pop ? 420 : 1400, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(pop ? 160 : 2100, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.09, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    oscillator.connect(gain); gain.connect(this.master); oscillator.start(); oscillator.stop(ctx.currentTime + 0.2);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  reload() {
    if (!this.context) return;
    const time = this.context.currentTime;
    this.play(this.impacts[0], time, 0.4); this.play(this.impacts[1], time + 1.65, 0.45);
    this.play(this.impacts[0], time + 2.18, 0.55);
  }
}
