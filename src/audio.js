  class SoundKit {
    constructor(muted) {
      this.muted = muted;
      this.ctx = null;
      this.master = null;
      this.samples = new Map();
      this.loading = null;
      this.loadFailed = false;
      this.destroyed = false;
      this.timers = new Set();
    }
    unlock() {
      if (this.muted || this.destroyed) return;
      try {
        if (!this.ctx) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          this.ctx = new Ctx();
          this.master = this.ctx.createGain();
          this.master.gain.value = 0.22;
          this.master.connect(this.ctx.destination);
        }
        this.loadSamples();
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      } catch {
        this.ctx = null;
      }
    }
    loadSamples() {
      if (!this.ctx || this.loading || this.loadFailed || !AUDIO_DATA) return this.loading;
      this.loading = (async () => {
        const ctx = this.ctx;
        for (const [name, encoded] of Object.entries(AUDIO_DATA)) {
          if (this.destroyed) return;
          const binary = atob(encoded);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const buffer = await ctx.decodeAudioData(bytes.buffer);
          if (this.destroyed) return;
          this.samples.set(name, buffer);
        }
      })().catch((error) => {
        if (this.destroyed) return;
        this.loadFailed = true;
        console.warn('[dsh-billiards] audio decode failed:', error);
      });
      return this.loading;
    }
    setMuted(muted) {
      this.muted = muted;
      if (this.master) this.master.gain.value = muted ? 0 : 0.22;
      if (!muted) this.unlock();
    }
    playSample(name, { gain = 0.5, rate = 1, lowpass = 0, highpass = 0 } = {}) {
      if (this.muted || !this.ctx) return false;
      const buffer = this.samples.get(name);
      if (!buffer) return false;
      try {
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = rate;
        const amp = this.ctx.createGain();
        amp.gain.value = gain;
        let node = source;
        if (lowpass > 0) {
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = lowpass;
          filter.Q.value = 0.5;
          node.connect(filter);
          node = filter;
        }
        if (highpass > 0) {
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.value = highpass;
          filter.Q.value = 0.5;
          node.connect(filter);
          node = filter;
        }
        node.connect(amp).connect(this.master);
        source.start(this.ctx.currentTime);
        return true;
      } catch {
        return false;
      }
    }
    blip(freq, duration, gain, type = 'sine') {
      if (this.muted || this.destroyed) return;
      this.unlock();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const amp = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.6), t + duration);
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(gain, t + 0.006);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(amp).connect(this.master);
      osc.start(t);
      osc.stop(t + duration + 0.02);
    }
    click(speed) {
      if (this.muted) return;
      this.unlock();
      const strength = clamp(speed / 1100, 0.05, 1);
      const soft = speed < 170;
      const rate = 0.93 + Math.random() * 0.14;
      const gain = (soft ? 0.34 : 0.52) * (0.28 + strength ** 0.72);
      const played = this.playSample(soft ? 'clickSoft' : 'click', {
        gain,
        rate,
        lowpass: soft ? 5200 : 9000,
      });
      return played;
    }
    rail(speed) {
      if (this.muted) return;
      this.unlock();
      const strength = clamp(speed / 1000, 0.04, 1);
      this.playSample('rail', {
        gain: 0.28 + strength * 0.42,
        rate: 0.92 + Math.random() * 0.08,
        lowpass: 1800,
      });
    }
    pocket() {
      if (this.muted) return;
      this.unlock();
      this.playSample('pocket', {
        gain: 0.6,
        rate: 0.96 + Math.random() * 0.06,
        lowpass: 7200,
      });
    }
    cue(power) {
      if (this.muted) return;
      this.unlock();
      this.playSample('cue', {
        gain: 0.42 + power * 0.24,
        rate: 0.97 + Math.random() * 0.03,
        lowpass: 6200,
      });
    }
    win() {
      this.melody([523, 659, 784, 1047], 110, 0.35, 0.05, 'sine');
    }
    lose() {
      this.melody([330, 262, 196], 130, 0.4, 0.045, 'triangle');
    }
    melody(notes, interval, duration, gain, type) {
      if (this.muted || this.destroyed) return;
      notes.forEach((freq, i) => {
        const timer = setTimeout(() => {
          this.timers.delete(timer);
          this.blip(freq, duration, gain, type);
        }, i * interval);
        this.timers.add(timer);
      });
    }
    destroy() {
      this.destroyed = true;
      this.muted = true;
      for (const timer of this.timers) clearTimeout(timer);
      this.timers.clear();
      this.samples.clear();
      if (this.ctx && this.ctx.state !== 'closed') this.ctx.close().catch(() => {});
    }
    ui() {
      this.blip(820, 0.04, 0.025, 'sine');
    }
  }
