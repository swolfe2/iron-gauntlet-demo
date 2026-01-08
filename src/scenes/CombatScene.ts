import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Boss } from '../entities/Boss';
import type { AttackZone } from '../systems/CombatSystem';
import { CombatSystem, COMBAT_CONFIG, GameMode } from '../systems/CombatSystem';
import { audioManager } from '../systems/AudioManager';

/**
 * CombatScene - The main boss fight arena
 * 
 * Handles input mapping for the "Active Defense" system:
 * - Mouse Move: Passive Block (updates Shield Zone)
 * - Mouse Click: Active Parry (triggers attemptParry)
 * 
 * Synchronizes the CombatSystem (logic) with Boss/Player (visuals).
 */
export class CombatScene extends Phaser.Scene {
    // Entities
    private player!: Player;
    private boss!: Boss;
    
    // Combat system
    private combat!: CombatSystem;
    private isPractice: boolean = false;
    
    // Fixed timestep accumulator
    private accumulator: number = 0;
    private lastBossHP: number = 0;
    private lastBossStagger: number = 0;
    private lastBlocksCount: number = 0;
    private wasVulnerable: boolean = false;
    private wasDesperation: boolean = false;
    private lastAttackId: string | null = null;
    private gameOverHandled: boolean = false;
    private tutorialActive: boolean = true;
    
    // UI elements
    private zoneIndicators!: Phaser.GameObjects.Graphics;
    private statusText!: Phaser.GameObjects.Text;
    private scoreText!: Phaser.GameObjects.Text;
    private statsText!: Phaser.GameObjects.Text;
    private alertText!: Phaser.GameObjects.Text;
    private practiceText?: Phaser.GameObjects.Text;
    
    constructor() {
        super({ key: 'CombatScene' });
    }

    preload(): void {
        // No assets to load (Programmatic Graphics)
    }

    create(data?: { isPractice?: boolean }): void {
        const urlParams = new URLSearchParams(window.location.search);
        this.isPractice = data?.isPractice ?? (urlParams.get('mode') === 'practice');

        const seed = Date.now();
        const mode = this.isPractice ? GameMode.PRACTICE : GameMode.STANDARD;
        this.combat = new CombatSystem(seed, 10, mode);
        
        // Wire up audio callbacks
        this.combat.onBlock = () => {
            audioManager.play('block');
        };
        
        // Create Boss (Top Center)
        // Moved down to 250 to prevent UI overlap
        this.boss = new Boss(this, 270, 250);
        
        // Create Player (Bottom Center)
        this.player = new Player(this, 270, 800);
        
        this.createZoneIndicators();
        this.setupInput();
        
        // UI
        // Removed conflicting title "IRON GAUNTLET" to prevent overlap with Boss Name
        
        this.statusText = this.add.text(270, 95, '', { // Default empty (No "FIGHT!")
            fontSize: '24px', color: '#ffffff', fontFamily: 'Arial'
        }).setOrigin(0.5);
        
        this.scoreText = this.add.text(10, 920, 'Score: 0', {
            fontSize: '16px', color: '#888888', fontFamily: 'Arial'
        });
        
        // Stats display (right side, stacked for readability)
        this.statsText = this.add.text(530, 900, '', {
            fontSize: '14px', color: '#cccccc', fontFamily: 'Arial', align: 'right'
        }).setOrigin(1, 0);
        
        // Alert text below player (for MUST PARRY warnings)
        this.alertText = this.add.text(270, 870, '', {
            fontSize: '28px', color: '#FF4444', fontFamily: 'Arial Black',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(30);
        
        this.add.text(270, 950, 'Move to BLOCK | Click to PARRY', {
            fontSize: '14px', color: '#666666'
        }).setOrigin(0.5);
        
        // Init State
        const state = this.combat.getState();
        this.lastBossHP = state.bossHP;
        this.lastBossStagger = state.bossStagger;
        
        console.log(`[CombatScene] Initialized. Mode: ${this.isPractice ? 'PRACTICE' : 'STANDARD'}`);

        if (this.isPractice) {
            this.scene.launch('PracticeUI', { combat: this.combat, parent: this });
            this.practiceText = this.add.text(10, 10, 'PRACTICE MODE', {
                fontSize: '12px', color: '#00ff00', backgroundColor: '#000000'
            });
        }
        
        // Show tutorial overlay
        this.showTutorial();
    }
    
    private showTutorial(): void {
        this.tutorialActive = true;
        
        // Dark overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.85);
        overlay.fillRect(0, 0, 540, 960);
        overlay.setDepth(100);
        
        // Title
        const title = this.add.text(270, 150, '⚔️ IRON GAUNTLET ⚔️', {
            fontSize: '32px', color: '#D4AF37', fontFamily: 'Arial Black'
        }).setOrigin(0.5).setDepth(101);
        
        // Instructions
        const instructions = [
            '📖 HOW TO PLAY',
            '',
            '🛡️ BLOCK (Passive)',
            'Move your mouse to the LEFT, CENTER, or RIGHT',
            'zone to block attacks from that direction.',
            '',
            '⚔️ PARRY (Active)',
            'CLICK the yellow bullseye when it appears!',
            'Closer clicks = more stagger damage.',
            '',
            '💥 STAGGER',
            'Fill the orange bar to stun the boss.',
            'Click as fast as you can to deal damage!',
            '',
            '⚠️ UNBLOCKABLE ATTACKS',
            'When you see "MUST PARRY" - blocking won\'t save you!',
            '',
        ];
        
        const text = this.add.text(270, 480, instructions.join('\n'), {
            fontSize: '16px', color: '#ffffff', fontFamily: 'Arial',
            align: 'center', lineSpacing: 4
        }).setOrigin(0.5).setDepth(101);
        
        // Start prompt
        const startText = this.add.text(270, 850, '[ TAP ANYWHERE TO BEGIN ]', {
            fontSize: '24px', color: '#00FF00', fontFamily: 'Arial Black'
        }).setOrigin(0.5).setDepth(101);
        
        // Pulse animation
        this.tweens.add({
            targets: startText,
            alpha: 0.5,
            duration: 600,
            yoyo: true,
            repeat: -1
        });
        
        // Click to dismiss
        this.input.once('pointerdown', () => {
            overlay.destroy();
            title.destroy();
            text.destroy();
            startText.destroy();
            this.tutorialActive = false;
        });
    }

    private createZoneIndicators(): void {
        this.zoneIndicators = this.add.graphics();
        this.updateZoneIndicators(COMBAT_CONFIG.ZONE_CENTER as AttackZone);
    }
    
    private updateZoneIndicators(activeZone: AttackZone): void {
        // Visual feedback for where the player is blocking
        this.zoneIndicators.clear();
        const zones = [
            { x: 90, zone: COMBAT_CONFIG.ZONE_LEFT },
            { x: 270, zone: COMBAT_CONFIG.ZONE_CENTER },
            { x: 450, zone: COMBAT_CONFIG.ZONE_RIGHT },
        ];
        
        for (const z of zones) {
            const isActive = z.zone === activeZone;
            // Draw zone lines
            this.zoneIndicators.lineStyle(2, isActive ? 0x4682B4 : 0x222222);
            this.zoneIndicators.strokeRect(z.x - 80, 0, 160, 960);
            
            if (isActive) {
                this.zoneIndicators.fillStyle(0x4682B4, 0.05);
                this.zoneIndicators.fillRect(z.x - 80, 0, 160, 960);
            }
        }
    }

    private setupInput(): void {
        // --- INPUTS ---
        // 1. Mobile Touch Zones (Background Layer)
        const zoneWidth = 540 / 3;
        const zoneHeight = 960;

        // Left Zone
        this.add.zone(0, 0, zoneWidth, zoneHeight)
            .setOrigin(0, 0)
            .setInteractive()
            .on('pointerdown', () => {
                if (this.tutorialActive) return;
                this.handleShieldMove(COMBAT_CONFIG.ZONE_LEFT);
            });

        // Center Zone
        this.add.zone(zoneWidth, 0, zoneWidth, zoneHeight)
            .setOrigin(0, 0)
            .setInteractive()
            .on('pointerdown', () => {
                if (this.tutorialActive) return;
                this.handleShieldMove(COMBAT_CONFIG.ZONE_CENTER);
            });

        // Right Zone
        this.add.zone(zoneWidth * 2, 0, zoneWidth, zoneHeight)
            .setOrigin(0, 0)
            .setInteractive()
            .on('pointerdown', () => {
                if (this.tutorialActive) return;
                this.handleShieldMove(COMBAT_CONFIG.ZONE_RIGHT);
            });

        // 2. Mouse/Touch Tracking (Hybrid - Dragging still works)
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (this.tutorialActive) return;
            // Only update if moving significantly (prevents jitter override)
            if (pointer.isDown) {
                 this.handleShieldMove(this.getZoneFromX(pointer.x));
            }
        });
        
        // 3. Click (Active Parry / Attack)
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            const zone = this.getZoneFromX(pointer.x);
            
            // Check context
            if (this.combat.getState().bossVulnerable) {
                // Vulnerable -> Attack!
                this.handleAttack();
            } else {
                // Combat -> Attempt Parry!
                this.handleParryAttempt(pointer, zone);
            }
        });
        
        // Keep Keyboard for debug/accessibility
        this.input.keyboard?.on('keydown-SPACE', () => {
             if (this.combat.getState().bossVulnerable) this.handleAttack();
        });
    }
    
    private getZoneFromX(x: number): AttackZone {
        // Map 0-540 width to 3 zones
        // Zones are centered at 90, 270, 450. Width 180 each.
        // 0-180: Left
        // 180-360: Center
        // 360-540: Right
        if (x < 180) return COMBAT_CONFIG.ZONE_LEFT;
        if (x < 360) return COMBAT_CONFIG.ZONE_CENTER;
        return COMBAT_CONFIG.ZONE_RIGHT;
    }

    private handleShieldMove(zone: AttackZone): void {
        if (this.combat.isRunOver()) return;
        
        // Logic Update
        this.combat.moveShield(zone);
        
        // Visual Update
        // Only valid if not parrying (Player handles this check internally actually)
        // Checks handled in Player.moveShieldToZone? No, Player.moveToZone handles state.
        // We just command it.
        this.player.moveToZone(zone as 0|1|2); // Cast to BlockZone
        
        this.updateZoneIndicators(zone);
    }
    
    private handleParryAttempt(pointer: Phaser.Input.Pointer, zone: AttackZone): void {
        if (this.combat.isRunOver()) return;

        // Calculate Accuracy based on Visual Target
        const targetPos = this.boss.getImpactPosition();
        let accuracy = 0.5; // Default if blindly parrying
        
        if (targetPos) {
            const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, targetPos.x, targetPos.y);
            const maxRadius = 80; 
            accuracy = Math.max(0, 1 - (dist / maxRadius));
        }
        
        // Logic Call
        const success = this.combat.attemptParry(zone, accuracy);
        
        if (success) {
            // Audio + Visual Feedback
            audioManager.play('parry');
            this.showFloatingText(accuracy > 0.9 ? 'PERFECT!' : 'PARRY!', 0xFFD700);
            this.player.moveToZone(zone as 0|1|2, true); // Trigger Parry Anim
        } else {
            // Whiff?
            // Only show whiff if we are actually attacking and missed window
            if (this.combat.getState().bossCurrentAttack) {
                 this.showFloatingText('WHIFF', 0x888888);
            }
        }
    }

    private handleAttack(): void {
        if (this.combat.isRunOver()) return;
        audioManager.play('hit');
        this.combat.playerAttack();
        this.player.attack();
    }
    
    private showFloatingText(text: string, color: number): void {
        const t = this.add.text(this.player.x, this.player.y - 100, text, {
            fontSize: '32px',
            color: '#'+color.toString(16),
            fontFamily: 'Arial Black',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        this.tweens.add({
            targets: t,
            y: t.y - 50,
            alpha: 0,
            duration: 800,
            onComplete: () => t.destroy()
        });
    }

    update(_time: number, delta: number): void {
        // Pause gameplay during tutorial
        if (this.tutorialActive) return;
        
        if (this.combat.isRunOver()) {
            if (!this.gameOverHandled) {
                this.handleGameOver();
                this.gameOverHandled = true;
            }
            return;
        }
        
        this.accumulator += delta;
        while (this.accumulator >= COMBAT_CONFIG.FRAME_TIME_MS) {
            this.combat.tick();
            this.accumulator -= COMBAT_CONFIG.FRAME_TIME_MS;
        }
        
        this.syncVisuals();
        this.scoreText.setText(`Score: ${this.combat.calculateScore()}`);
        
        // Update stats display
        const state = this.combat.getState();
        this.statsText.setText(
            `Blocks: ${state.blocksPerformed}  Parries: ${state.perfectParries}\n` +
            `Hits: ${state.damageDealt}  Deaths: ${state.deathCount}`
        );
    }

    private syncVisuals(): void {
        const state = this.combat.getState();
        
        // Boss HP/Stagger
        if (state.bossHP !== this.lastBossHP) {
            this.boss.updateHealthBar(state.bossHP / state.bossMaxHP);
            if (state.bossHP < this.lastBossHP) this.boss.playHitAnimation();
            this.lastBossHP = state.bossHP;
        }
        
        if (state.bossStagger !== this.lastBossStagger) {
            this.boss.updateStaggerBar(state.bossStagger / COMBAT_CONFIG.STAGGER_MAX);
            this.lastBossStagger = state.bossStagger;
        }
        
        // Block Detection (blocks happen in CombatSystem, detect via counter)
        if (state.blocksPerformed > this.lastBlocksCount) {
            audioManager.play('block');
            this.lastBlocksCount = state.blocksPerformed;
        }
        
        // Vulnerability Transition
        if (state.bossVulnerable && !this.wasVulnerable) {
            audioManager.play('stagger');
            this.boss.playStaggerAnimation();
            this.statusText.setText('STRIKE NOW!');
            this.statusText.setColor('#00FF00');
        } else if (!state.bossVulnerable && this.wasVulnerable) {
            this.boss.playRecoveryAnimation();
            this.statusText.setText(''); // Clear text
            this.statusText.setColor('#FFFFFF');
        }
        this.wasVulnerable = state.bossVulnerable;
        
        // Desperation Attack
        if (state.bossDesperation && !this.wasDesperation) {
            this.boss.playDesperationAnimation();
            this.statusText.setText('☠️ WARNING ☠️');
            this.statusText.setColor('#FF0000');
        }
        this.wasDesperation = state.bossDesperation;
        
        // Boss Attack Animation Trigger
        if (state.bossCurrentAttack && state.bossCurrentAttack.id !== this.lastAttackId) {
            this.boss.playAttackAnimation(state.bossCurrentAttack);
            
            // Different feedback for blockable vs unblockable attacks
            if (state.bossCurrentAttack.isBlocking) {
                audioManager.play('whoosh');
                this.alertText.setText(''); // Clear alert for blockable attacks
            } else {
                // Unblockable attack - MUST parry! (show below player)
                audioManager.play('danger');
                this.alertText.setText('⚠️ MUST PARRY! ⚠️');
            }
        }
        
        // Clear alert when no active attack
        if (!state.bossCurrentAttack) {
            this.alertText.setText('');
        }
        
        this.lastAttackId = state.bossCurrentAttack?.id || null;
    }

    private handleGameOver(): void {
        const state = this.combat.getState();
        const text = state.bossHP <= 0 ? 'VICTORY' : 'DEFEATED';
        const color = state.bossHP <= 0 ? '#00FF00' : '#FF0000';
        
        // Play appropriate sound
        audioManager.play(state.bossHP <= 0 ? 'victory' : 'defeat');
        
        this.statusText.setText(text);
        this.statusText.setColor(color);
        this.statusText.setFontSize(64);
        this.statusText.setY(480); // Center of screen for game over
        
        if (state.bossHP <= 0) this.boss.playDeathAnimation();

        // Retry Button
        const btn = this.add.text(270, 600, 'TAP TO RESET', {
            fontSize: '32px', color: '#D4AF37', backgroundColor: '#333333', padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive();
        
        btn.on('pointerdown', () => this.scene.restart());
    }
}
