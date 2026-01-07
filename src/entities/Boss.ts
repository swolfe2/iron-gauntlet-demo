import Phaser from 'phaser';
import type { Attack } from '../systems/CombatSystem';
import { COMBAT_CONFIG } from '../systems/CombatSystem';

/**
 * Boss - Geometric Rust Warden
 * 
 * Visuals:
 * - Rust-colored Armor (SaddleBrown) with Silver trim
 * - Dual Arms: Right (Mace), Left (Shield)
 * - Glowing Cyan Eye Slit
 * 
 * Animation:
 * - Uses "Perspective Lunge" (Scale Up + Move Down) to simulate attacking.
 * - Directional Lunges (Left/Center/Right) match attack zones.
 */
export class Boss extends Phaser.GameObjects.Container {
    // Visual Parts
    private bodyGraphics!: Phaser.GameObjects.Graphics;
    private rightArm!: Phaser.GameObjects.Graphics; // Mace (Screen Left)
    private leftArm!: Phaser.GameObjects.Graphics;  // Shield (Screen Right)
    
    // Impact Marker (Bullseye)
    private impactMarker?: Phaser.GameObjects.Graphics;
    private impactX?: number;
    private impactY?: number;
    
    // Animation state
    private isAttacking: boolean = false;
    private neutralPos: { x: number, y: number, scale: number };
    
    // Stagger / UI
    private staggerBar!: Phaser.GameObjects.Graphics;
    private staggerBarBg!: Phaser.GameObjects.Graphics;
    private hpBar!: Phaser.GameObjects.Graphics;
    private hpBarBg!: Phaser.GameObjects.Graphics;
    
    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y);
        scene.add.existing(this);
        
        this.neutralPos = { x, y, scale: 1.0 };
        
        this.createVisuals();
        this.createUI();
        
        console.log('[Boss] Geometric Rust Warden assembled!');
    }
    
    private createVisuals(): void {
        // 1. Body
        this.bodyGraphics = this.scene.add.graphics();
        // RUST WARDEN COLORS
        this.bodyGraphics.fillStyle(0x8B4513); // SaddleBrown (Rust)
        this.bodyGraphics.fillRoundedRect(-60, -80, 120, 140, 10);
        this.bodyGraphics.lineStyle(4, 0xC0C0C0); // Silver Trim
        this.bodyGraphics.strokeRoundedRect(-60, -80, 120, 140, 10);
        
        // Helmet / Head
        this.bodyGraphics.fillStyle(0x555555); // Dark Grey Helmet
        this.bodyGraphics.fillCircle(0, -90, 30);
        this.bodyGraphics.strokeCircle(0, -90, 30);
        
        // Glowing Eye Slit
        this.bodyGraphics.fillStyle(0x00FFFF); // Cyan Glow
        this.bodyGraphics.fillRect(-15, -95, 30, 6);
        
        // Shoulders
        this.bodyGraphics.fillStyle(0xA0522D); // Sienna
        this.bodyGraphics.fillCircle(-70, -60, 45); // Right Shoulder
        this.bodyGraphics.fillCircle(70, -60, 45);  // Left Shoulder
        this.bodyGraphics.strokeCircle(-70, -60, 45);
        this.bodyGraphics.strokeCircle(70, -60, 45);
        
        // 2. Right Arm (Mace)
        this.rightArm = this.scene.add.graphics();
        this.drawRightArm(0x808080);
        this.rightArm.setPosition(-70, -60);
        
        // 3. Left Arm (Shield)
        this.leftArm = this.scene.add.graphics();
        this.drawLeftArm(0x606060);
        this.leftArm.setPosition(70, -60);
        
        // Add to container (Order: Body, Arms)
        // Arms on top for clarity? Or body on top? 
        // Let's put arms slightly behind for depth or in front for threat.
        // In prototype, arms were on top.
        this.add([this.bodyGraphics, this.rightArm, this.leftArm]);
    }
    
    private createUI(): void {
        // UI Elements are NOT added to the Boss Container (this)
        // They stay fixed on the screen (World Space)
        
        // Name Text
        this.scene.add.text(270, 20, 'RUST WARDEN', {
            fontSize: '20px',
            color: '#ff4444',
            fontFamily: 'Arial Black',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(10); // Low Depth

        // HP Bar Background
        this.hpBarBg = this.scene.add.graphics();
        this.hpBarBg.fillStyle(0x333333);
        this.hpBarBg.fillRect(170, 40, 200, 15); // x=170, y=40 (Moved up from 50)
        this.hpBarBg.setDepth(10);
        
        // HP Bar Foreground
        this.hpBar = this.scene.add.graphics();
        this.hpBar.setDepth(11);
        
        // Stagger Bar Background
        this.staggerBarBg = this.scene.add.graphics();
        this.staggerBarBg.fillStyle(0x333333);
        this.staggerBarBg.fillRect(170, 60, 200, 10); // y=60 (Moved up from 70)
        this.staggerBarBg.setDepth(10);
        
        // Stagger Bar Foreground
        this.staggerBar = this.scene.add.graphics();
        this.staggerBar.setDepth(11);
        
        // Initialize
        this.updateHealthBar(1);
        this.updateStaggerBar(0);
        
        // Ensure Boss is IN FRONT of UI (Depth 100 > 11)
        this.setDepth(100);
    }
    
    updateHealthBar(hpPercent: number): void {
        this.hpBar.clear();
        this.hpBar.fillStyle(0xcc0000);
        // Draw in World Space (Fixed coords)
        this.hpBar.fillRect(170, 40, 200 * Math.max(0, hpPercent), 15);
    }

    updateStaggerBar(staggerPercent: number): void {
        this.staggerBar.clear();
        if (staggerPercent >= 0.75) this.staggerBar.fillStyle(0xff0000);
        else if (staggerPercent >= 0.5) this.staggerBar.fillStyle(0xffaa00);
        else this.staggerBar.fillStyle(0xffff00);
        
        this.staggerBar.fillRect(170, 60, 200 * staggerPercent, 10);
    }
    
    private drawRightArm(color: number): void {
        this.rightArm.clear();
        this.rightArm.lineStyle(4, 0x000000);
        this.rightArm.fillStyle(color);
        // Arm shaft
        this.rightArm.fillRect(-10, 0, 20, 200); 
        // Mace Head
        this.rightArm.fillStyle(0xC0C0C0);
        this.rightArm.fillCircle(0, 220, 40);
        this.rightArm.strokeCircle(0, 220, 40);
        // Spikes
        this.rightArm.fillStyle(0xFF0000);
        this.rightArm.fillTriangle(0, 260, -10, 240, 10, 240);
        this.rightArm.fillTriangle(-40, 220, -20, 210, -20, 230);
        this.rightArm.fillTriangle(40, 220, 20, 210, 20, 230);
    }

    private drawLeftArm(color: number): void {
        this.leftArm.clear();
        this.leftArm.lineStyle(4, 0x000000);
        this.leftArm.fillStyle(color);
        // Arm shaft
        this.leftArm.fillRect(-10, 0, 20, 180);
        // Tower Shield / Gauntlet
        this.leftArm.fillStyle(0x555555);
        this.leftArm.fillRect(-25, 150, 50, 60);
        this.leftArm.strokeRect(-25, 150, 50, 60);
    }

    /**
     * Play Attack Animation (Lunge)
     * Synchronized with CombatSystem timing
     */
    playAttackAnimation(attack: Attack): void {
        if (this.isAttacking) return; // Prevent overlapping attacks
        this.isAttacking = true;
        
        // Convert frames to ms
        const windupMs = (attack.windupFrames / 60) * 1000;
        const activeMs = (attack.activeFrames / 60) * 1000;
        const recoveryMs = (attack.recoveryFrames / 60) * 1000;
        
        console.log(`[Boss] Attack ${attack.id} (Zone ${attack.zone}). Windup: ${windupMs.toFixed(0)}ms`);

        // Determine Lunge Target X and telegraph direction
        let targetX = this.neutralPos.x;
        let telegraphX = this.neutralPos.x; // Where boss leans during telegraph
        let activeArm: Phaser.GameObjects.Graphics | null = null;
        let armRotation = 0;
        let telegraphArmRotation = 0; // Wind-up rotation (opposite of strike)
        
        if (attack.zone === COMBAT_CONFIG.ZONE_LEFT) {
            targetX = this.neutralPos.x - 60;
            telegraphX = this.neutralPos.x + 30; // Lean RIGHT to telegraph LEFT attack
            activeArm = this.rightArm;
            armRotation = -45;
            telegraphArmRotation = 30; // Wind arm back
        } else if (attack.zone === COMBAT_CONFIG.ZONE_RIGHT) {
            targetX = this.neutralPos.x + 60;
            telegraphX = this.neutralPos.x - 30; // Lean LEFT to telegraph RIGHT attack
            activeArm = this.leftArm;
            armRotation = 45;
            telegraphArmRotation = -30; // Wind arm back
        } else {
            // Center - pull straight back
            activeArm = this.rightArm;
            armRotation = 0;
            telegraphArmRotation = 20;
        }

        // Show zone warning indicator immediately
        const zoneNames = ['LEFT', 'CENTER', 'RIGHT'];
        const warningText = this.scene.add.text(targetX, 100, `⚠️ ${zoneNames[attack.zone]} ⚠️`, {
            fontSize: '28px',
            color: '#FF4444',
            fontFamily: 'Arial Black',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(100);

        // 1. Telegraph (Lean opposite direction + wind up arm) - CLEAR VISUAL CUE
        this.scene.tweens.add({
            targets: this,
            x: telegraphX, // LEAN toward opposite side (wind-up)
            y: this.neutralPos.y - 30, // Rise up
            scale: 0.85,
            duration: windupMs * 0.8, // Most of windup is visible telegraph
            ease: 'Power1',
            onStart: () => {
                // Start winding up the arm immediately
                if (activeArm) {
                    this.scene.tweens.add({
                        targets: activeArm,
                        rotation: Phaser.Math.DegToRad(telegraphArmRotation),
                        duration: windupMs * 0.5,
                        ease: 'Power2'
                    });
                }
            },
            onComplete: () => {
                // Remove warning text
                warningText.destroy();
                
                // 2. Lunge (Strike) - FAST
                this.scene.tweens.add({
                    targets: this,
                    x: targetX,
                    y: 450,
                    scale: 1.5,
                    duration: 250, // Very fast lunge
                    ease: 'Back.in',
                    onUpdate: () => {
                        if (activeArm) activeArm.setRotation(Phaser.Math.DegToRad(armRotation));
                    },
                    onComplete: () => {
                        // Impact happens here
                        this.scene.cameras.main.shake(100, 0.005);
                        
                        const remainingActive = Math.max(0, activeMs - 250);
                        this.scene.time.delayedCall(remainingActive, () => {
                            if (activeArm) activeArm.setRotation(0);
                            this.returnToNeutral(recoveryMs);
                        });
                    }
                });
            }
        });
        
        // SPAWN SWEET SPOT EARLY (1000ms before impact)
        // Impact is after windupMs + 250ms (lunge)?? 
        // No, Lunge starts after windup. Impact is at End of Lunge.
        // So Impact @ T = windupMs + 250.
        // Spawn @ T = Impact - 1000 = windupMs + 250 - 1000.
        // So delay = windupMs - 750.
        const spawnDelay = Math.max(0, windupMs - 750);
        
        this.scene.time.delayedCall(spawnDelay, () => {
             if (this.isAttacking) { // Only if still attacking
                 this.spawnImpactVisuals(attack.zone);
             }
        });
    }

    private spawnImpactVisuals(zone: number): void {
        // Spawn the "Bullseye" at the impact point
        // Position varies randomly to make parrying more challenging
        
        // Base X based on zone - pushed further apart
        let baseX = 270; // Center default (Player X)
        let xOffset = 0;
        
        if (zone === COMBAT_CONFIG.ZONE_LEFT) {
            baseX = 90;  // Far left
            xOffset = Math.random() * 80 + 20; // Offset 20-100 (biased right, but still in left zone)
        } else if (zone === COMBAT_CONFIG.ZONE_RIGHT) {
            baseX = 450; // Far right
            xOffset = -(Math.random() * 80 + 20); // Offset -100 to -20 (biased left, but still in right zone)
        } else {
            // Center zone: random ±60
            xOffset = (Math.random() - 0.5) * 120;
        }
        
        const x = Math.max(40, Math.min(500, baseX + xOffset)); // Clamp to screen
        
        // Random Y position in bottom section (makes parrying feel like an achievement)
        const y = 650 + Math.random() * 200; // 650-850

        // Store coordinates for getImpactPosition
        this.impactX = x;
        this.impactY = y;

        // Draw Bullseye - bright initially
        const circle = this.scene.add.graphics();
        circle.setDepth(20);
        this.impactMarker = circle;

        // Bright Yellow/White
        circle.fillStyle(0xFFFFFF, 1.0); // Start white-hot
        circle.fillCircle(x, y, 45);
        circle.lineStyle(4, 0xFFD700);
        circle.strokeCircle(x, y, 30);
        circle.fillStyle(0xFFD700);
        circle.fillCircle(x, y, 15);
        
        // Fade OUT over 1000ms (until impact roughly)
        // Visualizes "Time Running Out"
        this.scene.tweens.add({
            targets: circle,
            alpha: 0.2, // Fade to faint
            duration: 900, // 900ms fade
            onComplete: () => {
                // Auto-destroy if time runs out (Impact missed/blocked)
                // Actually CombatScene might call destroy logic? 
                // But let's have a fail-safe.
                if (this.impactMarker === circle) {
                     this.destroyImpactMarker();
                }
            }
        });
    }


    
    /**
     * Called when the attack resolves (impact happens or is parried)
     * Destroys the sweet spot immediately
     */
    destroyImpactMarker(): void {
        if (this.impactMarker) {
            this.scene.tweens.killTweensOf(this.impactMarker);
            this.impactMarker.destroy();
            this.impactMarker = undefined;
            this.impactX = undefined;
            this.impactY = undefined;
        }
    }

    private returnToNeutral(duration: number): void {
        this.scene.tweens.add({
            targets: this,
            x: this.neutralPos.x,
            y: this.neutralPos.y,
            scale: this.neutralPos.scale,
            duration: duration,
            ease: 'Power2',
            onComplete: () => {
                this.isAttacking = false;
            }
        });
    }


    
    playHitAnimation(): void {
        // Flash alpha instead of tint (Graphics doesn't support tint)
        this.scene.tweens.add({
            targets: [this.bodyGraphics, this.rightArm, this.leftArm],
            alpha: 0.2, // Flash transparent
            duration: 50,
            yoyo: true,
            repeat: 3,
            onComplete: () => {
                this.bodyGraphics.setAlpha(1);
                this.rightArm.setAlpha(1);
                this.leftArm.setAlpha(1);
            }
        });
        
        this.scene.tweens.add({
            targets: this,
            x: this.x + 10,
            duration: 50,
            yoyo: true,
            repeat: 3
        });
    }

    playStaggerAnimation(): void {
        console.log('[Boss] STAGGERED!');
        this.scene.tweens.add({
            targets: this,
            alpha: 0.5,
            duration: 100,
            yoyo: true,
            repeat: 5
        });
        // Arms drop
        this.scene.tweens.add({
            targets: [this.rightArm, this.leftArm],
            rotation: 0.8,
            y: 50,
            duration: 200,
        });
    }

    playRecoveryAnimation(): void {
        this.scene.tweens.add({
            targets: [this.rightArm, this.leftArm],
            rotation: 0,
            y: -60,
            duration: 500
        });
    }

    playDesperationAnimation(): void {
        // Raise both arms
        this.scene.tweens.add({
            targets: [this.rightArm, this.leftArm],
            rotation: -0.8,
            y: -80,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => {
                // Slam
                this.scene.tweens.add({
                    targets: [this.rightArm, this.leftArm],
                    rotation: 1.2,
                    y: 80,
                    duration: 100,
                    ease: 'Power4'
                });
            }
        });
    }

    playDeathAnimation(): void {
        this.scene.tweens.add({
            targets: this,
            y: this.y + 100,
            alpha: 0,
            duration: 2000,
            ease: 'Power2'
        });
    }
    
    /**
     * Get the current position of the active impact marker (Bullseye)
     * Used for calculating parry accuracy
     */
    getImpactPosition(): { x: number, y: number } | undefined {
        if (this.impactMarker && this.impactX !== undefined && this.impactY !== undefined) {
            return { x: this.impactX, y: this.impactY };
        }
        return undefined;
    }
}
