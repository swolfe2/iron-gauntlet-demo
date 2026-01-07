/**
 * AudioManager.ts - Procedural Sound Effects
 * 
 * Uses Web Audio API to generate game sounds procedurally.
 * This approach:
 * - Zero external dependencies (no audio files to load)
 * - Instant feedback (no loading time)
 * - Can be replaced with Freesound assets later
 */

export class AudioManager {
    private context: AudioContext | null = null;
    private enabled: boolean = true;
    private masterVolume: number = 0.5;

    constructor() {
        // AudioContext must be created after user interaction
        this.initOnInteraction();
    }

    private initOnInteraction(): void {
        const init = () => {
            if (!this.context) {
                this.context = new AudioContext();
                console.log('[Audio] AudioContext initialized');
            }
            document.removeEventListener('click', init);
            document.removeEventListener('keydown', init);
            document.removeEventListener('touchstart', init);
        };
        
        document.addEventListener('click', init);
        document.addEventListener('keydown', init);
        document.addEventListener('touchstart', init);
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    setVolume(volume: number): void {
        this.masterVolume = Math.max(0, Math.min(1, volume));
    }

    /**
     * Play a named sound effect
     */
    play(soundName: string): void {
        if (!this.enabled || !this.context) return;

        switch (soundName) {
            case 'parry':
                this.playParry();
                break;
            case 'block':
                this.playBlock();
                break;
            case 'hit':
                this.playHit();
                break;
            case 'whoosh':
                this.playWhoosh();
                break;
            case 'stagger':
                this.playStagger();
                break;
            case 'victory':
                this.playVictory();
                break;
            case 'defeat':
                this.playDefeat();
                break;
            case 'danger':
                this.playDanger();
                break;
            default:
                console.warn(`[Audio] Unknown sound: ${soundName}`);
        }
    }

    /**
     * PARRY - Satisfying metallic clang
     * High-pitched, sharp, with ring-out
     */
    private playParry(): void {
        if (!this.context) return;
        const ctx = this.context;
        const now = ctx.currentTime;

        // Main impact tone
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'square';
        osc1.frequency.setValueAtTime(800, now);
        osc1.frequency.exponentialRampToValueAtTime(400, now + 0.1);
        gain1.gain.setValueAtTime(0.3 * this.masterVolume, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc1.connect(gain1).connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.15);

        // Metallic ring
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(2400, now);
        osc2.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
        gain2.gain.setValueAtTime(0.15 * this.masterVolume, now);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc2.connect(gain2).connect(ctx.destination);
        osc2.start(now);
        osc2.stop(now + 0.3);

        // Click transient
        this.playNoise(0.02, 0.4);
    }

    /**
     * BLOCK - Dull thud
     * Lower pitched, muffled
     */
    private playBlock(): void {
        if (!this.context) return;
        const ctx = this.context;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);
        gain.gain.setValueAtTime(0.4 * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);

        // Soft thud noise
        this.playNoise(0.05, 0.2);
    }

    /**
     * HIT - Meaty impact on boss
     * Punchy, satisfying
     */
    private playHit(): void {
        if (!this.context) return;
        const ctx = this.context;
        const now = ctx.currentTime;

        // Low punch
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
        gain.gain.setValueAtTime(0.5 * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);

        // Impact noise
        this.playNoise(0.03, 0.5);
    }

    /**
     * WHOOSH - Boss attack telegraph
     * Sweeping, ominous
     */
    private playWhoosh(): void {
        if (!this.context) return;
        const ctx = this.context;
        const now = ctx.currentTime;

        // Filtered noise sweep
        const bufferSize = ctx.sampleRate * 0.4;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(200, now);
        filter.frequency.exponentialRampToValueAtTime(2000, now + 0.3);
        filter.Q.value = 1;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.2 * this.masterVolume, now + 0.15);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.4);

        noise.connect(filter).connect(gain).connect(ctx.destination);
        noise.start(now);
        noise.stop(now + 0.4);
    }

    /**
     * STAGGER - Boss becomes vulnerable
     * Dramatic, rewarding
     */
    private playStagger(): void {
        if (!this.context) return;
        const ctx = this.context;
        const now = ctx.currentTime;

        // Low rumble
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.5);
        gain.gain.setValueAtTime(0.3 * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);

        // Success chime
        setTimeout(() => {
            if (!this.context) return;
            const chime = this.context.createOscillator();
            const chimeGain = this.context.createGain();
            chime.type = 'sine';
            chime.frequency.value = 880;
            chimeGain.gain.setValueAtTime(0.2 * this.masterVolume, this.context.currentTime);
            chimeGain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.3);
            chime.connect(chimeGain).connect(this.context.destination);
            chime.start();
            chime.stop(this.context.currentTime + 0.3);
        }, 200);
    }

    /**
     * VICTORY - Boss defeated
     * Triumphant fanfare
     */
    private playVictory(): void {
        if (!this.context) return;
        const ctx = this.context;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        
        notes.forEach((freq, i) => {
            setTimeout(() => {
                if (!this.context) return;
                const osc = this.context.createOscillator();
                const gain = this.context.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.25 * this.masterVolume, this.context.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.4);
                osc.connect(gain).connect(this.context.destination);
                osc.start();
                osc.stop(this.context.currentTime + 0.4);
            }, i * 150);
        });
    }

    /**
     * DEFEAT - Player death
     * Somber, quick
     */
    private playDefeat(): void {
        if (!this.context) return;
        const ctx = this.context;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
        gain.gain.setValueAtTime(0.3 * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
    }

    /**
     * DANGER - Unblockable attack warning
     * Two-tone alarm
     */
    private playDanger(): void {
        if (!this.context) return;
        const ctx = this.context;
        const now = ctx.currentTime;

        // Two alternating tones
        [0, 0.15].forEach((delay, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = i === 0 ? 600 : 800; // Alternating pitch
            gain.gain.setValueAtTime(0.25 * this.masterVolume, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.12);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now + delay);
            osc.stop(now + delay + 0.12);
        });
    }

    /**
     * Helper: Play noise burst
     */
    private playNoise(duration: number, volume: number): void {
        if (!this.context) return;
        const ctx = this.context;
        const now = ctx.currentTime;

        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        noise.connect(gain).connect(ctx.destination);
        noise.start(now);
        noise.stop(now + duration);
    }
}

// Singleton instance
export const audioManager = new AudioManager();
