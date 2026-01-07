/**
 * CombatSystem.ts - Core Combat Mechanics
 */

export const GameMode = {
    STANDARD: 0,
    PRACTICE: 1
} as const;

export type GameMode = typeof GameMode[keyof typeof GameMode];

export const COMBAT_CONFIG = {
    TICKS_PER_SECOND: 60,
    FRAME_TIME_MS: 1000 / 60,
    
    // Defense windows
    PARRY_WINDOW_FRAMES: 15,
    IMPACT_DELAY_FRAMES: 25,
    BLOCK_WINDOW_FRAMES: 30,
    
    // Stagger
    BLOCK_STAGGER: 5,
    PARRY_STAGGER: 25,
    STAGGER_MAX: 100,
    STAGGER_DECAY_PER_SECOND: 0.5, // Reduced from 5 to allow meter building
    
    VULNERABILITY_DURATION_FRAMES: 180,
    SAFE_ATTACK_DAMAGE: 1,
    CRITICAL_DAMAGE: 3,
    
    ZONE_LEFT: 0,
    ZONE_CENTER: 1,
    ZONE_RIGHT: 2,
    
    INPUT_BUFFER_FRAMES: 5,
};

// ... Attack interface ...
export type AttackZone = number;

export interface Attack {
    id: string;
    zone: AttackZone;
    windupFrames: number;
    activeFrames: number;
    recoveryFrames: number;
    damage: number;
    isBlocking: boolean;
}

export interface InputEvent {
    frame: number;
    type: 'block' | 'attack' | 'parry';
    zone?: AttackZone;
    accuracy?: number;
}

export interface CombatState {
    currentFrame: number;
    playerAlive: boolean;
    playerShieldZone: AttackZone;
    playerAttacking: boolean;
    playerAttackFrame: number;
    
    bossHP: number;
    bossMaxHP: number;
    bossStagger: number;
    bossVulnerable: boolean;
    bossVulnerableFrame: number;
    bossDesperation: boolean;
    
    bossCurrentAttack: Attack | null;
    bossAttackStartFrame: number;
    bossAttackHitProcessed: boolean;
    
    perfectParries: number;
    blocksPerformed: number;
    damageDealt: number;
    deathCount: number;
    runStartTime: number;

    mode: GameMode;
    enabledAttacks: Set<string>;
}

export const RUST_WARDEN_ATTACKS: Attack[] = [
    {
        id: 'bash_left',
        zone: COMBAT_CONFIG.ZONE_LEFT,
        windupFrames: 120,   // 2 seconds telegraph - plenty of reaction time
        activeFrames: 40,
        recoveryFrames: 30,
        damage: 1,
        isBlocking: true,
    },
    {
        id: 'bash_center',
        zone: COMBAT_CONFIG.ZONE_CENTER,
        windupFrames: 100,   // 1.67s - center is slightly faster
        activeFrames: 40,
        recoveryFrames: 30,
        damage: 1,
        isBlocking: true,
    },
    {
        id: 'bash_right',
        zone: COMBAT_CONFIG.ZONE_RIGHT,
        windupFrames: 120,   // 2 seconds
        activeFrames: 40,
        recoveryFrames: 30,
        damage: 1,
        isBlocking: true,
    },
    {
        id: 'flail_sweep',
        zone: COMBAT_CONFIG.ZONE_CENTER,
        windupFrames: 90,
        activeFrames: 45,
        recoveryFrames: 60,
        damage: 1,
        isBlocking: false,
    },
    {
        id: 'desperation_slam',
        zone: COMBAT_CONFIG.ZONE_CENTER,
        windupFrames: 90,
        activeFrames: 30,
        recoveryFrames: 120,
        damage: 1,
        isBlocking: false,
    },
];

export class CombatSystem {
    private state: CombatState;
    private inputLog: InputEvent[] = [];
    private _runSeed: number;
    private rng: () => number;
    private forcedAttackQueue: string[] = [];
    
    // Event callbacks for audio/visual sync
    public onBlock?: () => void;
    public onParry?: (isPerfect: boolean) => void;
    
    constructor(seed: number, bossMaxHP: number = 10, mode: GameMode = GameMode.STANDARD) {
        this._runSeed = seed;
        this.rng = this.createSeededRandom(seed);
        
        const enabledAttacks = new Set(RUST_WARDEN_ATTACKS.map(a => a.id));

        this.state = {
            currentFrame: 0,
            playerAlive: true,
            playerShieldZone: COMBAT_CONFIG.ZONE_CENTER,
            playerAttacking: false,
            playerAttackFrame: 0,
            bossHP: bossMaxHP,
            bossMaxHP: bossMaxHP,
            bossStagger: 0,
            bossVulnerable: false,
            bossVulnerableFrame: 0,
            bossDesperation: false,
            bossCurrentAttack: null,
            bossAttackStartFrame: 0,
            bossAttackHitProcessed: false,
            perfectParries: 0,
            blocksPerformed: 0,
            damageDealt: 0,
            deathCount: 0,
            runStartTime: Date.now(),
            mode: mode,
            enabledAttacks: enabledAttacks
        };
    }
    
    private createSeededRandom(seed: number): () => number {
        let state = seed;
        return () => {
            state = (state * 1103515245 + 12345) & 0x7fffffff;
            return state / 0x7fffffff;
        };
    }
    
    getState(): Readonly<CombatState> {
        return { ...this.state };
    }
    
    getInputLog(): InputEvent[] {
        return [...this.inputLog];
    }
    
    getRunSeed(): number {
        return this._runSeed;
    }

    setPracticeAttack(attackId: string, enabled: boolean): void {
        if (this.state.mode !== GameMode.PRACTICE) return;
        if (enabled) this.state.enabledAttacks.add(attackId);
        else this.state.enabledAttacks.delete(attackId);
    }

    forceAttack(attackId: string): void {
        if (this.state.mode !== GameMode.PRACTICE) return;
        this.forcedAttackQueue.push(attackId);
    }
    
    moveShield(zone: AttackZone): void {
        if (!this.state.playerAlive) return;
        this.state.playerShieldZone = zone;
        this.inputLog.push({ frame: this.state.currentFrame, type: 'block', zone: zone });
    }
    
    attemptParry(zone: AttackZone, accuracy: number = 1.0): boolean {
        if (!this.state.playerAlive) return false;
        
        this.inputLog.push({ frame: this.state.currentFrame, type: 'parry', zone, accuracy });

        const attack = this.state.bossCurrentAttack;
        if (!attack || this.state.bossAttackHitProcessed) return false;

        const framesSinceStart = this.state.currentFrame - this.state.bossAttackStartFrame;
        
        // Allow "Pre-Parry" (Reaction) during the end of Windup
        // The Sweet Spot appears ~1s (60 frames) before impact.
        // Let's allow parrying if within 45 frames (750ms) of impact to catch reaction clicks.
        const earlyWindow = 45; 
        
        if (framesSinceStart >= attack.windupFrames - earlyWindow && 
            framesSinceStart < attack.windupFrames + attack.activeFrames) {
            
            if (zone === attack.zone) {
                this.handleParry(attack, accuracy);
                this.state.bossAttackHitProcessed = true;
                return true;
            }
        }
        return false;
    }

    playerAttack(): void {
        if (!this.state.playerAlive || this.state.playerAttacking) return;
        if (!this.state.bossVulnerable) return;
        
        this.state.playerAttacking = true;
        this.state.playerAttackFrame = this.state.currentFrame;
        
        this.inputLog.push({ frame: this.state.currentFrame, type: 'attack' });
    }
    
    tick(): void {
        if (!this.state.playerAlive) return;
        
        this.state.currentFrame++;
        
        this.processBossAI();
        this.processAttackCollision();
        this.processPlayerAttack();
        
        if (!this.state.bossVulnerable) {
            this.state.bossStagger = Math.max(
                0,
                this.state.bossStagger - (COMBAT_CONFIG.STAGGER_DECAY_PER_SECOND / COMBAT_CONFIG.TICKS_PER_SECOND)
            );
        }
        
        this.processVulnerability();
    }
    
    private processBossAI(): void {
        if (this.state.bossCurrentAttack || this.state.bossVulnerable) return;
        
        // Practice Queue
        if (this.forcedAttackQueue.length > 0) {
            const forcedId = this.forcedAttackQueue.shift()!;
            const attack = RUST_WARDEN_ATTACKS.find(a => a.id === forcedId);
            if (attack) {
                this.executeAttack(attack);
                return;
            }
        }
        
        // Random Attack - FIXED: Removed stagger penalty to ensure aggression loops
        // Base chance per tick. 0.03 = ~1.8 attacks per second (too fast?)
        // 0.01 = ~0.6 attacks per second (1 every 1.5s).
        // Let's go with 0.015 (~1 attack every second).
        const attackChance = 0.015; 
        
        if (this.rng() < attackChance) {
            this.startBossAttack();
        }
    }
    
    private startBossAttack(): void {
        const availableAttacks = RUST_WARDEN_ATTACKS.filter(a => 
            this.state.mode === GameMode.STANDARD || this.state.enabledAttacks.has(a.id)
        );
        if (availableAttacks.length === 0) return;

        const attackIndex = Math.floor(this.rng() * availableAttacks.length);
        this.executeAttack(availableAttacks[attackIndex]);
    }

    private executeAttack(attack: Attack): void {
        this.state.bossCurrentAttack = attack;
        this.state.bossAttackStartFrame = this.state.currentFrame;
        this.state.bossAttackHitProcessed = false;
    }
    
    private processAttackCollision(): void {
        const attack = this.state.bossCurrentAttack;
        if (!attack) return; // FIX: Return if no attack
        
        const framesSinceStart = this.state.currentFrame - this.state.bossAttackStartFrame;
        const totalFrames = attack.windupFrames + attack.activeFrames + attack.recoveryFrames;

        if (!this.state.bossAttackHitProcessed) {
            const attackFrame = framesSinceStart - attack.windupFrames;
            
            // IMPACT Logic
            if (attackFrame === COMBAT_CONFIG.IMPACT_DELAY_FRAMES) {
                const blocking = this.state.playerShieldZone === attack.zone;
                console.log(`[Combat] Impact! Shield:${this.state.playerShieldZone} Attack:${attack.zone} Blocking:${blocking} isBlockable:${attack.isBlocking}`);
                if (blocking && attack.isBlocking) {
                    this.handleBlock();
                } else {
                    this.handlePlayerDeath();
                }
                this.state.bossAttackHitProcessed = true;
            }
        }
        
        // Clear attack after full sequence
        if (framesSinceStart >= totalFrames) {
            this.state.bossCurrentAttack = null;
        }
    }
    
    private handleParry(_attack: Attack, accuracy: number): void {
        this.state.perfectParries++;
        const multiplier = accuracy > 0.9 ? 1.5 : 1.0;
        this.state.bossStagger += COMBAT_CONFIG.PARRY_STAGGER * multiplier;
        
        if (this.state.bossStagger >= COMBAT_CONFIG.STAGGER_MAX) {
            this.triggerVulnerability();
        } else {
             // If not vulnerable, maybe interrupt attack? 
             // Currently parry allows attack to "finish" visually but deals no damage?
             // Or should parry end the attack immediately?
             // "Punch Out" style: Parry stops the attack and stuns boss briefly?
             // For now, let's keep it flowing, but maybe shorten recovery?
        }
        
        if (this.state.bossDesperation) {
            this.dealDamageToBoss(COMBAT_CONFIG.CRITICAL_DAMAGE);
        }
        
        console.log(`[Combat] PARRY! Acc: ${accuracy.toFixed(2)}, Stagger: ${this.state.bossStagger}%`);
    }
    
    private handleBlock(): void {
        this.state.blocksPerformed++;
        this.state.bossStagger += COMBAT_CONFIG.BLOCK_STAGGER; 
        if (this.state.bossStagger >= COMBAT_CONFIG.STAGGER_MAX) {
            this.triggerVulnerability();
        }
        // Trigger callback for audio
        if (this.onBlock) this.onBlock();
        console.log(`[Combat] Blocked. Stagger: ${this.state.bossStagger}%`);
    }
    
    private handlePlayerDeath(): void {
        this.state.deathCount++; // Track deaths even in practice for feedback
        if (this.state.mode === GameMode.PRACTICE) {
            console.log('[Combat] Player simulated death (PRACTICE)');
            return;
        }
        this.state.playerAlive = false;
        console.log('[Combat] PLAYER DIED');
    }
    
    private triggerVulnerability(): void {
        this.state.bossVulnerable = true;
        this.state.bossVulnerableFrame = this.state.currentFrame;
        this.state.bossStagger = 0;
        this.state.bossCurrentAttack = null; // Interrupt current attack!
        console.log('[Combat] BOSS VULNERABLE!');
    }
    
    private processVulnerability(): void {
        if (!this.state.bossVulnerable) return;
        
        const framesInVulnerability = this.state.currentFrame - this.state.bossVulnerableFrame;
        
        if (framesInVulnerability > COMBAT_CONFIG.VULNERABILITY_DURATION_FRAMES * 0.7 && !this.state.bossDesperation) {
            // Desperation Phase logic could spawn here
        }
        
        if (framesInVulnerability >= COMBAT_CONFIG.VULNERABILITY_DURATION_FRAMES) {
            this.state.bossVulnerable = false;
            this.state.bossDesperation = false;
        }
    }
    
    private processPlayerAttack(): void {
        if (!this.state.playerAttacking) return;
        const framesSinceAttack = this.state.currentFrame - this.state.playerAttackFrame;
        
        if (framesSinceAttack === 10) {
            if (this.state.bossVulnerable) {
                 this.dealDamageToBoss(COMBAT_CONFIG.SAFE_ATTACK_DAMAGE);
            }
        }
        
        if (framesSinceAttack >= 20) {
            this.state.playerAttacking = false;
        }
    }
    
    private dealDamageToBoss(damage: number): void {
        this.state.bossHP -= damage;
        this.state.damageDealt += damage;
        console.log(`[Combat] Dealt ${damage} damage! Boss HP: ${this.state.bossHP}/${this.state.bossMaxHP}`);
    }
    
    calculateScore(baseBossXP: number = 1000): number {
        const secondsRemaining = Math.max(0, 300 - (Date.now() - this.state.runStartTime) / 1000);
        const damageTaken = this.state.playerAlive ? 0 : 1;
        if (this.state.mode === GameMode.PRACTICE) return 0;
        return Math.round(baseBossXP + (this.state.perfectParries * 50) + (secondsRemaining * 10) - (damageTaken * 20));
    }
    
    isBossDefeated(): boolean {
        return this.state.bossHP <= 0;
    }
    
    isRunOver(): boolean {
        if (this.state.mode === GameMode.PRACTICE) return this.isBossDefeated();
        return !this.state.playerAlive || this.isBossDefeated();
    }
}

export default CombatSystem;
