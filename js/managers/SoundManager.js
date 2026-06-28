// ============================================================
// SoundManager — Procedural audio via Web Audio API (no files)
// Global singleton: window.SoundMgr
// ============================================================

window.SoundManager = class SoundManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;

        this._muted = false;
        this._musicPlaying = false;
        this._musicTrack = 'game'; // 'home' | 'game'
        this._musicTimer = null;
        this._musicStep = 0;
        this._nextNoteTime = 0;
        this._lastAbsorbTime = 0;
        this._lastWarnTime = 0;
        this._lastCollideTime = 0;

        // Load saved preferences (volumes: 0.0–1.0 float; 0.5 = old default = 50% of max range)
        try { this._muted = localStorage.getItem('bbf_muted') === '1'; } catch {}
        try { const sv = parseFloat(localStorage.getItem('bbf_sfxvol3'));   this._sfxVol   = isNaN(sv) ? 0.5 : Math.max(0, Math.min(1, sv)); } catch { this._sfxVol   = 0.5; }
        try { const mv = parseFloat(localStorage.getItem('bbf_musicvol3')); this._musicVol = isNaN(mv) ? 0.7 : Math.max(0, Math.min(1, mv)); } catch { this._musicVol = 0.7; }

        this._init();
    }

    _init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            // Master
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this._muted ? 0 : 0.85;
            this.masterGain.connect(this.ctx.destination);
            // SFX bus
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = (this._sfxVol ?? 0.5) * 4.0;   // 0→0  0.5→2.0  1→4.0
            this.sfxGain.connect(this.masterGain);
            // Music bus
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = (this._musicVol ?? 0.7) * 1.32; // 0→0  0.5→0.66  1→1.32
            this.musicGain.connect(this.masterGain);

            // Browser autoplay policy: AudioContext starts suspended.
            // Must resume from a synchronous DOM event handler — Phaser's
            // input system runs inside requestAnimationFrame, which some
            // browsers don't accept as a valid user-gesture context.
            const _resume = () => {
                if (this.ctx && this.ctx.state === 'suspended') {
                    this.ctx.resume();
                }
            };
            document.addEventListener('pointerdown', _resume, { passive: true });
            document.addEventListener('touchstart',  _resume, { passive: true });
            document.addEventListener('keydown',     _resume, { passive: true });
        } catch (e) {
            console.warn('[SoundManager] Web Audio not available');
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    _canPlay() {
        if (!this.ctx) return false;
        if (this.ctx.state !== 'running') { this.ctx.resume(); return false; }
        return true;
    }

    get muted() { return this._muted; }

    // Volume: 0.0–1.0 float.  0.5 = "old full volume".  1.0 = 2× louder.
    get sfxVolume()   { return this._sfxVol   ?? 0.5; }
    get musicVolume() { return this._musicVol ?? 0.5; }

    setSfxVolume(v) {   // v: 0.0 – 1.0
        this._sfxVol = Math.max(0, Math.min(1, v));
        try { localStorage.setItem('bbf_sfxvol3', this._sfxVol); } catch {}
        if (this.sfxGain && this.ctx) {
            this.sfxGain.gain.setTargetAtTime(this._sfxVol * 4.0, this.ctx.currentTime, 0.04);
        }
    }

    setMusicVolume(v) { // v: 0.0 – 1.0
        this._musicVol = Math.max(0, Math.min(1, v));
        try { localStorage.setItem('bbf_musicvol3', this._musicVol); } catch {}
        if (this.musicGain && this.ctx) {
            this.musicGain.gain.setTargetAtTime(this._musicVol * 1.32, this.ctx.currentTime, 0.04);
        }
    }

    toggleMute() {
        this._muted = !this._muted;
        try { localStorage.setItem('bbf_muted', this._muted ? '1' : '0'); } catch {}
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setTargetAtTime(
                this._muted ? 0 : 0.85,
                this.ctx.currentTime, 0.06
            );
        }
        return this._muted;
    }

    // ── Low-level helpers ────────────────────────────────────────────────

    _osc(freq, gainPeak, t, dur, type = 'sine', bus = null) {
        if (!this.ctx) return;
        bus = bus || this.sfxGain;
        const osc = this.ctx.createOscillator();
        const g   = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(gainPeak, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g); g.connect(bus);
        osc.start(t); osc.stop(t + dur + 0.01);
    }

    _noise(t, dur, gainPeak, filterType, filterFreq, Q = 1, bus = null) {
        if (!this.ctx) return;
        bus = bus || this.sfxGain;
        const sr  = this.ctx.sampleRate;
        const len = Math.ceil(sr * dur);
        const buf = this.ctx.createBuffer(1, len, sr);
        const d   = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src  = this.ctx.createBufferSource();
        src.buffer = buf;
        const filt = this.ctx.createBiquadFilter();
        filt.type = filterType;
        filt.frequency.value = filterFreq;
        filt.Q.value = Q;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(gainPeak, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(filt); filt.connect(g); g.connect(bus);
        src.start(t); src.stop(t + dur + 0.01);
    }

    // ── SFX ─────────────────────────────────────────────────────────────

    blockTap() {
        if (!this._canPlay()) return;
        const t = this.ctx.currentTime;
        // Soft pop: sine drop
        const osc = this.ctx.createOscillator();
        const g   = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(960, t);
        osc.frequency.exponentialRampToValueAtTime(480, t + 0.075);
        g.gain.setValueAtTime(0.22, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
        osc.connect(g); g.connect(this.sfxGain);
        osc.start(t); osc.stop(t + 0.08);
    }

    cubeBurst() {
        if (!this._canPlay()) return;
        const t = this.ctx.currentTime;
        // Impact click
        this._osc(200, 0.4, t, 0.04, 'triangle');
        // Noise crunch body
        this._noise(t, 0.14, 0.45, 'bandpass', 700, 1.5);
        // High crack
        this._noise(t, 0.07, 0.25, 'highpass', 3500, 1);
    }

    cubeCollide(speed = 2) {
        if (!this._canPlay()) return;
        const now = performance.now();
        if (now - this._lastCollideTime < 38) return;
        this._lastCollideTime = now;
        const t = this.ctx.currentTime;
        const freq = 700 + Math.random() * 500;
        const gain = Math.min(0.10, 0.03 + speed * 0.012);
        this._osc(freq, gain, t, 0.038, 'sine');
    }

    cubeAbsorb(pitchRand = 0) {
        if (!this._canPlay()) return;
        const now = performance.now();
        if (now - this._lastAbsorbTime < 35) return;
        this._lastAbsorbTime = now;
        const t = this.ctx.currentTime;
        const freq = 1500 + pitchRand * 600;
        this._osc(freq, 0.09, t, 0.055, 'sine');
    }

    carFull() {
        if (!this._canPlay()) return;
        const t = this.ctx.currentTime;
        // C5 - E5 - G5 ascending ding
        const notes = [523.25, 659.25, 783.99];
        notes.forEach((f, i) => {
            this._osc(f, 0.28, t + i * 0.10, 0.38, 'sine');
            // subtle octave shimmer
            this._osc(f * 2, 0.08, t + i * 0.10, 0.2, 'sine');
        });
        this._noise(t + 0.05, 0.18, 0.10, 'bandpass', 350, 2);
    }

    carExit() {
        if (!this._canPlay()) return;
        const t = this.ctx.currentTime;
        // Downward engine whoosh
        const osc = this.ctx.createOscillator();
        const g   = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, t);
        osc.frequency.exponentialRampToValueAtTime(70, t + 0.4);
        g.gain.setValueAtTime(0.18, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        osc.connect(g); g.connect(this.sfxGain);
        osc.start(t); osc.stop(t + 0.41);
        this._noise(t, 0.22, 0.12, 'lowpass', 600, 1);
    }

    conveyorWarn() {
        if (!this._canPlay()) return;
        const now = performance.now();
        if (now - this._lastWarnTime < 1800) return;
        this._lastWarnTime = now;
        const t = this.ctx.currentTime;
        this._osc(440, 0.12, t,        0.09, 'square');
        this._osc(440, 0.12, t + 0.16, 0.09, 'square');
    }

    buttonClick() {
        if (!this._canPlay()) return;
        const t = this.ctx.currentTime;
        this._osc(1100, 0.10, t, 0.045, 'sine');
    }

    boosterActivate() {
        if (!this._canPlay()) return;
        const t = this.ctx.currentTime;
        this._osc(880,  0.18, t,        0.06, 'sine');
        this._osc(1320, 0.18, t + 0.07, 0.10, 'sine');
        this._osc(1760, 0.22, t + 0.14, 0.14, 'sine');
    }

    winJingle() {
        if (!this._canPlay()) return;
        const t = this.ctx.currentTime;
        // C4-E4-G4-C5-E5 ascending fanfare
        const mel = [261.63, 329.63, 392, 523.25, 659.25];
        mel.forEach((f, i) => {
            this._osc(f,     0.32, t + i * 0.13, 0.55, 'triangle');
            this._osc(f * 2, 0.10, t + i * 0.13, 0.35, 'sine');
        });
        // Shimmer noise burst at peak
        this._noise(t + 0.5, 0.3, 0.12, 'bandpass', 2000, 3);
    }

    loseSfx() {
        if (!this._canPlay()) return;
        const t = this.ctx.currentTime;
        // G4 - Eb4 - C4 - Bb3 descending with pitch slide
        const mel = [392, 311.13, 261.63, 233.08];
        mel.forEach((f, i) => {
            const ts = t + i * 0.22;
            const osc = this.ctx.createOscillator();
            const g   = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(f, ts);
            osc.frequency.exponentialRampToValueAtTime(f * 0.88, ts + 0.2);
            g.gain.setValueAtTime(0, ts);
            g.gain.linearRampToValueAtTime(0.22, ts + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, ts + 0.42);
            osc.connect(g); g.connect(this.sfxGain);
            osc.start(ts); osc.stop(ts + 0.43);
        });
    }

    // ── Background Music ─────────────────────────────────────────────────
    //
    // Two gentle G-major pentatonic loops, swapped by scene:
    //  'home' — slow ambient pad + sparse melody, no percussion
    //  'game' — soft marimba melody + pad + a light shaker, still calm
    //
    // Pentatonic index table (freq in Hz):
    //  0=G2  1=A2  2=B2  3=D3  4=E3
    //  5=G3  6=A3  7=B3  8=D4  9=E4
    // 10=G4 11=A4 12=B4 13=D5 14=E5
    // 15=G5 16=A5 17=B5 18=D6 19=E6

    startMusic(track = 'game') {
        if (!this.ctx) return;
        if (this._musicPlaying) {
            if (this._musicTrack !== track) {
                this._musicTrack = track;
                this._musicStep  = 0; // restart pattern cleanly on track switch
            }
            return;
        }
        if (this.ctx.state !== 'running') {
            const retry = () => {
                this.ctx.resume().then(() => this.startMusic(track));
                document.removeEventListener('pointerdown', retry);
            };
            document.addEventListener('pointerdown', retry, { once: true, passive: true });
            return;
        }
        this.musicGain.gain.setValueAtTime(0, this.ctx.currentTime);
        this.musicGain.gain.linearRampToValueAtTime(0.66, this.ctx.currentTime + 2.0);
        this._musicPlaying = true;
        this._musicTrack   = track;
        this._musicStep    = 0;
        this._nextNoteTime = this.ctx.currentTime + 0.1;
        this._scheduleMusic();
    }

    stopMusic(fadeDur = 0.8) {
        this._musicPlaying = false;
        if (this._musicTimer) { clearTimeout(this._musicTimer); this._musicTimer = null; }
        if (this.musicGain && this.ctx) {
            this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, fadeDur / 4);
            setTimeout(() => {
                if (this.musicGain) this.musicGain.gain.value = 0.66;
            }, fadeDur * 1000 + 200);
        }
    }

    _getMusicPatterns(track) {
        if (track === 'home') {
            return {
                bpm: 100,
                // Sparse, slow melody — long gaps for a calm ambient feel
                melody: [
                    10,-1,-1,-1, -1,-1,-1,-1,  8,-1,-1,-1, -1,-1,-1,-1,
                    12,-1,-1,-1, -1,-1,-1,-1, 10,-1,-1,-1, -1,-1,-1,-1,
                ],
                // Slow sustained pad chords
                chord: [
                     5,-1,-1,-1, -1,-1,-1,-1, -1,-1,-1,-1, -1,-1,-1,-1,
                     7,-1,-1,-1, -1,-1,-1,-1, -1,-1,-1,-1, -1,-1,-1,-1,
                ],
                // Soft, infrequent bass root
                bass: [
                     0,-1,-1,-1, -1,-1,-1,-1, -1,-1,-1,-1, -1,-1,-1,-1,
                     3,-1,-1,-1, -1,-1,-1,-1, -1,-1,-1,-1, -1,-1,-1,-1,
                ],
                shaker: null, // no percussion — pure ambient
            };
        }
        // 'game' — a touch more flowing, still gentle
        return {
            bpm: 116,
            melody: [
                10,-1,12,-1, -1,-1,11,-1, 10,-1,-1,-1,  8,-1,-1,-1,
                13,-1,12,-1, -1,-1,11,-1, 10,-1,-1,-1, -1,-1,-1,-1,
            ],
            chord: [
                 5,-1,-1,-1,  7,-1,-1,-1,  8,-1,-1,-1,  7,-1,-1,-1,
                 8,-1,-1,-1,  9,-1,-1,-1,  8,-1,-1,-1,  7,-1,-1,-1,
            ],
            bass: [
                 0,-1,-1,-1, -1,-1,-1,-1,  3,-1,-1,-1, -1,-1,-1,-1,
                 4,-1,-1,-1, -1,-1,-1,-1,  0,-1,-1,-1, -1,-1,-1,-1,
            ],
            // Very soft shaker on the beat only — keeps light momentum, no drums
            shaker: [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0, 1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
        };
    }

    _scheduleMusic() {
        if (!this._musicPlaying || !this.ctx) return;

        const LOOK_AHEAD = 0.14;
        const pat  = this._getMusicPatterns(this._musicTrack);
        const step = 60 / pat.bpm / 4; // 16th note

        const penta = [
             98.00, 110.00, 123.47, 146.83, 164.81,  // G2..E3 (0-4)
            196.00, 220.00, 246.94, 293.66, 329.63,  // G3..E4 (5-9)
            392.00, 440.00, 493.88, 587.33, 659.25,  // G4..E5 (10-14)
            783.99, 880.00, 987.77,1174.66,1318.51,  // G5..E6 (15-19)
        ];

        const { melody, chord, bass, shaker } = pat;
        const LEN = melody.length;

        while (this._nextNoteTime < this.ctx.currentTime + LOOK_AHEAD) {
            const s = this._musicStep % LEN;
            const t = this._nextNoteTime;

            // Melody — soft, gently sustained (triangle)
            if (melody[s] >= 0) {
                this._mNote(penta[melody[s]], 0.06, t, step * 1.4, 'triangle');
            }

            // Chord pad (sine, long sustain, very quiet)
            if (chord[s] >= 0) {
                this._mNote(penta[chord[s]], 0.034, t, step * 4.2, 'sine');
            }

            // Bass (sine, soft and long)
            if (bass[s] >= 0) {
                this._mNote(penta[bass[s]] * 0.5, 0.13, t, step * 3.6, 'sine');
            }

            // Light shaker — only present on the 'game' track
            if (shaker && shaker[s]) this._mHat(t);

            this._musicStep++;
            this._nextNoteTime += step;
        }

        this._musicTimer = setTimeout(() => this._scheduleMusic(), 22);
    }

    _mNote(freq, gain, t, dur, type) {
        const osc = this.ctx.createOscillator();
        const g   = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(gain, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g); g.connect(this.musicGain);
        osc.start(t); osc.stop(t + dur + 0.01);
    }

    _mHat(t) {
        // Soft shaker tick — quieter than a real hi-hat to stay gentle
        this._mNoise(t, 0.016, 0.05, 'highpass', 7000, 1);
    }

    _mNoise(t, gain, dur, filterType, filterFreq, Q) {
        const sr  = this.ctx.sampleRate;
        const len = Math.ceil(sr * dur);
        const buf = this.ctx.createBuffer(1, len, sr);
        const d   = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src  = this.ctx.createBufferSource();
        src.buffer = buf;
        const filt = this.ctx.createBiquadFilter();
        filt.type = filterType;
        filt.frequency.value = filterFreq;
        filt.Q.value = Q || 1;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(filt); filt.connect(g); g.connect(this.musicGain);
        src.start(t); src.stop(t + dur + 0.01);
    }
};

// Global singleton — available everywhere
window.SoundMgr = new SoundManager();
