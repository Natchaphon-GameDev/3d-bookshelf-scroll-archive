/* =========================================================
   SOUND ENGINE
   - Ambient music: detuned-pad C-minor with sparse high tinkles,
     slow filter LFO, synthetic reverb, gentle vinyl crackle.
   - SFX: per-object reveal sounds, shelf bumps, dust puffs, UI clicks.
   All procedural — no audio assets needed.
   ========================================================= */

(function () {

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.musicGain = null;
      this.sfxGain = null;
      this.muted = false;
      this.music = null;
      this.musicPlaying = false;
      this._lastReveal = 0;
    }

    ensure() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return true;
      }
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return false;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.7;
        this.master.connect(this.ctx.destination);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0; // music off by default
        this.musicGain.connect(this.master);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.55;
        this.sfxGain.connect(this.master);

        return true;
      } catch (e) {
        console.warn('Audio init failed', e);
        return false;
      }
    }

    // ---------- helpers ----------
    _noiseBuffer(seconds) {
      const len = Math.floor(this.ctx.sampleRate * seconds);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    }
    _noiseBurst({ duration = 0.3, gain = 0.1, filterType = 'bandpass', freq = 1000, q = 4, decay = 'linear', dest }) {
      if (!this.ensure()) return;
      const ctx = this.ctx;
      const buf = this._noiseBuffer(duration);
      // pre-shape decay into buffer
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / data.length;
        const env = decay === 'exp' ? Math.exp(-3 * t) : (1 - t);
        data[i] *= env;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = filterType;
      filt.frequency.value = freq;
      filt.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(filt).connect(g).connect(dest || this.sfxGain);
      src.start();
      src.stop(ctx.currentTime + duration + 0.05);
    }
    _tone({ freq = 440, duration = 0.2, type = 'sine', gain = 0.1, attack = 0.005, decay = 'exp', detune = 0 }) {
      if (!this.ensure()) return;
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const g = ctx.createGain();
      const now = ctx.currentTime;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(gain, now + attack);
      if (decay === 'exp') {
        g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      } else {
        g.gain.linearRampToValueAtTime(0, now + duration);
      }
      osc.connect(g).connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + duration + 0.05);
    }

    // ---------- SFX ----------
    shelfBump() {
      if (!this.ensure() || !this.musicPlaying) return;
      // low-thunk + brief wood-knock buzz
      this._tone({ freq: 78, duration: 0.32, type: 'sine', gain: 0.18, attack: 0.002 });
      this._tone({ freq: 110, duration: 0.18, type: 'triangle', gain: 0.06, attack: 0.002 });
      this._noiseBurst({ duration: 0.18, gain: 0.07, freq: 220, q: 4, decay: 'exp' });
    }

    reveal(type) {
      if (!this.ensure() || !this.musicPlaying) return;
      // throttle so rapid scrolls don't spam
      const now = performance.now();
      if (now - this._lastReveal < 200) return;
      this._lastReveal = now;

      switch (type) {
        case 'cartridge': {
          // plastic "click in" — short two-note thump
          this._tone({ freq: 320, duration: 0.06, type: 'square', gain: 0.05, attack: 0.001, decay: 'exp' });
          setTimeout(() => this._tone({ freq: 160, duration: 0.14, type: 'square', gain: 0.07, attack: 0.001, decay: 'exp' }), 55);
          this._noiseBurst({ duration: 0.08, gain: 0.04, freq: 1200, q: 3, decay: 'exp' });
          break;
        }
        case 'cd': {
          // clamshell case open — plastic clack + small hinge whoosh
          this._noiseBurst({ duration: 0.06, gain: 0.10, freq: 4500, q: 6, decay: 'exp' });
          setTimeout(() => this._noiseBurst({ duration: 0.45, gain: 0.04, freq: 2200, q: 1.5, decay: 'exp' }), 70);
          this._tone({ freq: 260, duration: 0.05, type: 'sine', gain: 0.04 });
          break;
        }
        case 'disk': {
          // floppy slide out of paper sleeve — soft slide-rustle
          this._noiseBurst({ duration: 0.55, gain: 0.10, freq: 1600, q: 2, decay: 'linear' });
          setTimeout(() => this._tone({ freq: 90, duration: 0.10, type: 'sine', gain: 0.04 }), 380);
          break;
        }
        case 'box': {
          // cardboard lid scrape + soft thud
          this._noiseBurst({ duration: 0.42, gain: 0.11, freq: 900, q: 2, decay: 'linear' });
          this._tone({ freq: 110, duration: 0.22, type: 'sine', gain: 0.07, attack: 0.005 });
          this._tone({ freq: 70, duration: 0.30, type: 'sine', gain: 0.05 });
          break;
        }
        case 'cabinet': {
          // CRT flicker on — very high pitched whine + electrical ping
          this._tone({ freq: 15700, duration: 0.45, type: 'square', gain: 0.012, attack: 0.05, decay: 'linear' });
          this._noiseBurst({ duration: 0.25, gain: 0.05, freq: 2400, q: 4, decay: 'exp' });
          this._tone({ freq: 60, duration: 0.18, type: 'sine', gain: 0.04 }); // mains hum
          break;
        }
        case 'tablet': {
          // soft glass tap + UI tone
          this._tone({ freq: 1800, duration: 0.08, type: 'sine', gain: 0.06, decay: 'exp' });
          setTimeout(() => this._tone({ freq: 2400, duration: 0.12, type: 'sine', gain: 0.04, decay: 'exp' }), 90);
          break;
        }
        case 'scroll': {
          // unfurling paper — long rustling whoosh
          this._noiseBurst({ duration: 1.0, gain: 0.06, freq: 3000, q: 1.5, decay: 'linear' });
          break;
        }
        case 'fossil': {
          // deep sub + stone shift
          this._tone({ freq: 48, duration: 0.7, type: 'sine', gain: 0.18, attack: 0.01, decay: 'exp' });
          this._noiseBurst({ duration: 0.5, gain: 0.05, freq: 220, q: 3, decay: 'exp' });
          break;
        }
        default: {
          this._tone({ freq: 220, duration: 0.1, type: 'sine', gain: 0.05 });
        }
      }
    }

    dustPuff() {
      if (!this.ensure() || !this.musicPlaying) return;
      this._noiseBurst({ duration: 0.55, gain: 0.05, freq: 1400, q: 2, decay: 'linear' });
    }

    uiClick() {
      if (!this.ensure() || !this.musicPlaying) return;
      this._tone({ freq: 1500, duration: 0.04, type: 'square', gain: 0.04 });
      this._tone({ freq: 700, duration: 0.05, type: 'square', gain: 0.02 });
    }

    // ---------- AMBIENT MUSIC ----------
    _makeReverbIR(seconds) {
      const ctx = this.ctx;
      const len = Math.floor(ctx.sampleRate * seconds);
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.3);
        }
      }
      return buf;
    }

    startMusic() {
      if (!this.ensure()) return;
      if (this.musicPlaying) return;
      this.musicPlaying = true;
      const ctx = this.ctx;

      // soft master fade-in to musicGain
      this.musicGain.gain.cancelScheduledValues(ctx.currentTime);
      this.musicGain.gain.setTargetAtTime(0.42, ctx.currentTime, 2.2);

      this._musicNodes = [];
      this._musicTimers = [];

      // global lowpass filter (slow LFO modulates it)
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1100;
      filter.Q.value = 0.8;
      filter.connect(this.musicGain);

      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.04;
      lfoG.gain.value = 380;
      lfo.connect(lfoG).connect(filter.frequency);
      lfo.start();

      // synthetic reverb send
      const reverb = ctx.createConvolver();
      reverb.buffer = this._makeReverbIR(2.6);
      const revGain = ctx.createGain();
      revGain.gain.value = 0.55;
      reverb.connect(revGain).connect(filter);

      this._musicNodes.push(lfo, lfoG, filter, reverb, revGain);

      // C-minor pad: C2, G2, Eb3, Bb3, Eb4, G4
      const pad = [65.41, 98.00, 155.56, 233.08, 311.13, 392.0];
      pad.forEach((f, i) => {
        // detuned pair (chorus)
        [-4, 4].forEach((cents) => {
          const osc = ctx.createOscillator();
          osc.type = i === 0 ? 'sine' : (i < 3 ? 'triangle' : 'sine');
          osc.frequency.value = f;
          osc.detune.value = cents;
          const g = ctx.createGain();
          g.gain.value = 0.045 / (i * 0.5 + 1);
          // slow amplitude LFO per oscillator
          const aLfo = ctx.createOscillator();
          const aLfoG = ctx.createGain();
          aLfo.frequency.value = 0.06 + i * 0.035;
          aLfoG.gain.value = g.gain.value * 0.5;
          aLfo.connect(aLfoG).connect(g.gain);
          aLfo.start();
          osc.connect(g);
          g.connect(filter);
          g.connect(reverb);
          osc.start();
          this._musicNodes.push(osc, g, aLfo, aLfoG);
        });
      });

      // sparse high pentatonic tinkles
      const tinkleNotes = [932.33, 1108.73, 1244.51, 1396.91, 1567.98, 1864.66];
      const scheduleTinkle = () => {
        if (!this.musicPlaying) return;
        const delay = 7 + Math.random() * 8;
        const tm = setTimeout(() => {
          if (!this.musicPlaying) return;
          const f = tinkleNotes[Math.floor(Math.random() * tinkleNotes.length)];
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = f;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, ctx.currentTime);
          g.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 4.5);
          osc.connect(g);
          g.connect(reverb);
          g.connect(filter);
          osc.start();
          osc.stop(ctx.currentTime + 4.6);
          scheduleTinkle();
        }, delay * 1000);
        this._musicTimers.push(tm);
      };
      scheduleTinkle();

      // vinyl crackle: sparse impulse loop, high-passed
      const crBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
      const crData = crBuf.getChannelData(0);
      for (let i = 0; i < crData.length; i++) {
        crData[i] = (Math.random() < 0.004) ? (Math.random() * 2 - 1) * 0.4 : 0;
      }
      const crSrc = ctx.createBufferSource();
      crSrc.buffer = crBuf;
      crSrc.loop = true;
      const crFilter = ctx.createBiquadFilter();
      crFilter.type = 'highpass';
      crFilter.frequency.value = 2400;
      const crG = ctx.createGain();
      crG.gain.value = 0.18;
      crSrc.connect(crFilter).connect(crG).connect(this.musicGain);
      crSrc.start();
      this._musicNodes.push(crSrc, crFilter, crG);
    }

    stopMusic() {
      if (!this.musicPlaying) return;
      this.musicPlaying = false;
      const ctx = this.ctx;
      this.musicGain.gain.cancelScheduledValues(ctx.currentTime);
      this.musicGain.gain.setTargetAtTime(0, ctx.currentTime, 1.4);
      (this._musicTimers || []).forEach((t) => clearTimeout(t));
      this._musicTimers = [];
      setTimeout(() => {
        (this._musicNodes || []).forEach((n) => {
          try { if (n.stop) n.stop(); } catch (e) {}
          try { if (n.disconnect) n.disconnect(); } catch (e) {}
        });
        this._musicNodes = [];
      }, 2200);
    }

    toggleMusic() {
      if (!this.ensure()) return false;
      if (this.musicPlaying) { this.stopMusic(); return false; }
      else { this.startMusic(); return true; }
    }

    setMute(v) {
      if (!this.ensure()) return;
      this.muted = !!v;
      this.master.gain.setTargetAtTime(v ? 0 : 0.7, this.ctx.currentTime, 0.2);
    }
  }

  window.Sound = new SoundEngine();

  // Unlock audio on first user gesture
  let unlocked = false;
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    window.Sound.ensure();
  }
  ['click', 'touchstart', 'keydown', 'wheel'].forEach((ev) =>
    window.addEventListener(ev, unlock, { once: true, passive: true })
  );
})();
