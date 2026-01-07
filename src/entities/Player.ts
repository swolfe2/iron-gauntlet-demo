import Phaser from 'phaser';

/**
 * Player Animation States
 */
export type PlayerState = 'neutral' | 'blocking' | 'parrying' | 'attacking' | 'hit';

/**
 * Block Zone (0=LEFT, 1=CENTER, 2=RIGHT)
 */
export type BlockZone = 0 | 1 | 2;

/**
 * Player - Clean animated character with clear visual feedback
 * 
 * Uses simple graphics primitives for maximum clarity:
 * - Body: Rounded rectangle (knight silhouette)
 * - Shield: Rectangle that moves to block zones
 * - Sword: Line/rectangle for attacks
 * 
 * State-based animations with distinct visual feedback for:
 * - Neutral (idle stance)
 * - Blocking (shield moved, reduced opacity)
 * - Parrying (shield moved, flash effect, screen shake)
 * - Attacking (sword swing animation)
 */
export class Player extends Phaser.GameObjects.Container {
    // Visual components
    private bodyGraphics: Phaser.GameObjects.Graphics;
    private shield: Phaser.GameObjects.Graphics;
    private sword: Phaser.GameObjects.Graphics;
    private parryFlash: Phaser.GameObjects.Graphics;
    
    // State tracking
    private currentState: PlayerState = 'neutral';
    private currentZone: BlockZone = 1;
    
    // Shield position configs (relative to player center)
    private readonly SHIELD_POSITIONS = {
        0: { x: -80, y: 0, rotation: -0.4 },    // LEFT
        1: { x: 0, y: -20, rotation: 0 },       // CENTER  
        2: { x: 80, y: 0, rotation: 0.4 }       // RIGHT
    };
    
    // Colors
    private readonly COLORS = {
        body: 0x8B4513,         // Saddle brown (knight)
        bodyOutline: 0x5D3A1A,  // Darker brown
        shield: 0x708090,       // Slate gray (metal)
        shieldBlock: 0x4682B4,  // Steel blue (blocking)
        shieldParry: 0xFFD700,  // Gold (perfect parry!)
        sword: 0xC0C0C0,        // Silver
        swordSwing: 0xFFFFFF,   // White (swinging)
        parryFlash: 0xFFD700,   // Gold flash
    };
    
    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y);
        scene.add.existing(this);
        
        // Create graphics layers (order = render order)
        this.sword = scene.add.graphics();
        this.bodyGraphics = scene.add.graphics();
        this.shield = scene.add.graphics();
        this.parryFlash = scene.add.graphics();
        
        this.add([this.sword, this.bodyGraphics, this.shield, this.parryFlash]);
        
        // Draw initial state
        this.drawBody();
        this.drawShield(this.currentZone, 'neutral');
        this.drawSword('neutral');
        
        console.log('[Player] Clean player created!');
    }
    
    /**
     * Draw the player body (knight silhouette)
     */
    private drawBody(): void {
        this.bodyGraphics.clear();
        
        // Body outline
        this.bodyGraphics.lineStyle(3, this.COLORS.bodyOutline);
        this.bodyGraphics.fillStyle(this.COLORS.body);
        
        // Torso (rounded rectangle)
        this.bodyGraphics.fillRoundedRect(-30, -40, 60, 80, 10);
        this.bodyGraphics.strokeRoundedRect(-30, -40, 60, 80, 10);
        
        // Head (circle)
        this.bodyGraphics.fillCircle(0, -60, 25);
        this.bodyGraphics.strokeCircle(0, -60, 25);
        
        // Helmet visor (rectangle)
        this.bodyGraphics.fillStyle(0x333333);
        this.bodyGraphics.fillRect(-15, -70, 30, 10);
        
        // Shoulder pauldrons
        this.bodyGraphics.fillStyle(this.COLORS.body);
        this.bodyGraphics.fillCircle(-40, -30, 15);
        this.bodyGraphics.strokeCircle(-40, -30, 15);
        this.bodyGraphics.fillCircle(40, -30, 15);
        this.bodyGraphics.strokeCircle(40, -30, 15);
    }
    
    /**
     * Draw the shield in a specific zone with visual state
     */
    private drawShield(zone: BlockZone, state: 'neutral' | 'blocking' | 'parrying'): void {
        this.shield.clear();
        
        const pos = this.SHIELD_POSITIONS[zone];
        
        // Choose color based on state
        let fillColor = this.COLORS.shield;
        let alpha = 0.9;
        
        if (state === 'blocking') {
            fillColor = this.COLORS.shieldBlock;
            alpha = 1.0;
        } else if (state === 'parrying') {
            fillColor = this.COLORS.shieldParry;
            alpha = 1.0;
        }
        
        // Save and transform
        this.shield.save();
        this.shield.translateCanvas(pos.x, pos.y);
        this.shield.rotateCanvas(pos.rotation);
        
        // Shield shape (heater shield)
        this.shield.lineStyle(3, 0x333333);
        this.shield.fillStyle(fillColor, alpha);
        
        // Draw shield as polygon (heater shield shape)
        this.shield.beginPath();
        this.shield.moveTo(0, -40);      // Top center
        this.shield.lineTo(25, -30);     // Top right
        this.shield.lineTo(25, 10);      // Right side
        this.shield.lineTo(0, 40);       // Bottom point
        this.shield.lineTo(-25, 10);     // Left side
        this.shield.lineTo(-25, -30);    // Top left
        this.shield.closePath();
        this.shield.fillPath();
        this.shield.strokePath();
        
        // Shield boss (center decoration)
        this.shield.fillStyle(0x666666);
        this.shield.fillCircle(0, -5, 10);
        this.shield.strokeCircle(0, -5, 10);
        
        // Restore transform
        this.shield.restore();
    }
    
    /**
     * Draw the sword
     */
    private drawSword(state: 'neutral' | 'attacking'): void {
        this.sword.clear();
        
        const color = state === 'attacking' ? this.COLORS.swordSwing : this.COLORS.sword;
        
        // Sword at ready position (right side, pointing up-right)
        this.sword.save();
        this.sword.translateCanvas(50, -20);
        this.sword.rotateCanvas(state === 'attacking' ? -0.8 : 0.3);
        
        // Blade
        this.sword.lineStyle(3, 0x333333);
        this.sword.fillStyle(color);
        this.sword.fillRect(-5, -60, 10, 50);
        this.sword.strokeRect(-5, -60, 10, 50);
        
        // Crossguard
        this.sword.fillStyle(0x8B4513);
        this.sword.fillRect(-15, -12, 30, 8);
        
        // Handle
        this.sword.fillRect(-4, -5, 8, 25);
        
        this.sword.restore();
    }
    
    /**
     * Show parry flash effect
     */
    private showParryFlash(zone: BlockZone): void {
        const pos = this.SHIELD_POSITIONS[zone];
        
        this.parryFlash.clear();
        this.parryFlash.fillStyle(this.COLORS.parryFlash, 0.8);
        this.parryFlash.fillCircle(pos.x, pos.y, 60);
        
        // Fade out
        this.scene.tweens.add({
            targets: this.parryFlash,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                this.parryFlash.clear();
                this.parryFlash.alpha = 1;
            }
        });
        
        // Screen shake for parry feedback
        this.scene.cameras.main.shake(100, 0.01);
    }
    
    /**
     * Move shield to block a zone
     */
    moveToZone(zone: BlockZone, isParry: boolean = false): void {
        const previousZone = this.currentZone;
        this.currentZone = zone;
        
        if (isParry) {
            // PARRY - Gold flash, screen shake
            this.currentState = 'parrying';
            this.showParryFlash(zone);
            this.drawShield(zone, 'parrying');
            
            // Return to blocking state after flash
            this.scene.time.delayedCall(150, () => {
                if (this.currentState === 'parrying') {
                    this.currentState = 'blocking';
                    this.drawShield(zone, 'blocking');
                }
            });
        } else {
            // BLOCK - Blue shield, no flash
            this.currentState = 'blocking';
            
            // Animate shield movement
            if (previousZone !== zone) {
                this.animateShieldMove(previousZone, zone);
            } else {
                this.drawShield(zone, 'blocking');
            }
        }
    }
    
    /**
     * Animate shield moving between zones
     */
    private animateShieldMove(fromZone: BlockZone, toZone: BlockZone): void {
        
        const fromPos = this.SHIELD_POSITIONS[fromZone];
        const toPos = this.SHIELD_POSITIONS[toZone];
        
        // Create a tween target object
        const tweenTarget = { progress: 0 };
        
        this.scene.tweens.add({
            targets: tweenTarget,
            progress: 1,
            duration: 80,
            ease: 'Power2',
            onUpdate: () => {
                const p = tweenTarget.progress;
                const currentX = fromPos.x + (toPos.x - fromPos.x) * p;
                const currentY = fromPos.y + (toPos.y - fromPos.y) * p;
                const currentRot = fromPos.rotation + (toPos.rotation - fromPos.rotation) * p;
                
                // Redraw shield at interpolated position
                this.shield.clear();
                this.shield.save();
                this.shield.translateCanvas(currentX, currentY);
                this.shield.rotateCanvas(currentRot);
                
                // Shield shape
                this.shield.lineStyle(3, 0x333333);
                this.shield.fillStyle(this.COLORS.shieldBlock, 1.0);
                this.shield.beginPath();
                this.shield.moveTo(0, -40);
                this.shield.lineTo(25, -30);
                this.shield.lineTo(25, 10);
                this.shield.lineTo(0, 40);
                this.shield.lineTo(-25, 10);
                this.shield.lineTo(-25, -30);
                this.shield.closePath();
                this.shield.fillPath();
                this.shield.strokePath();
                this.shield.fillStyle(0x666666);
                this.shield.fillCircle(0, -5, 10);
                this.shield.strokeCircle(0, -5, 10);
                this.shield.restore();
            },
            onComplete: () => {
                this.drawShield(toZone, 'blocking');
            }
        });
    }
    
    /**
     * Return shield to neutral position
     */
    returnToNeutral(): void {
        this.currentState = 'neutral';
        this.drawShield(this.currentZone, 'neutral');
    }
    
    /**
     * Perform attack animation
     */
    attack(): void {
        if (this.currentState === 'attacking') return;
        
        this.currentState = 'attacking';
        
        // Wind up
        this.scene.tweens.add({
            targets: { rotation: 0.3 },
            rotation: 0.8,
            duration: 60,
            onUpdate: (tween) => {
                this.sword.clear();
                this.sword.save();
                this.sword.translateCanvas(50, -20);
                this.sword.rotateCanvas(tween.getValue() as number);
                this.drawSwordBlade(this.COLORS.sword);
                this.sword.restore();
            },
            onComplete: () => {
                // Swing forward
                this.scene.tweens.add({
                    targets: { rotation: 0.8 },
                    rotation: -1.2,
                    duration: 80,
                    ease: 'Power3',
                    onUpdate: (tween) => {
                        this.sword.clear();
                        this.sword.save();
                        this.sword.translateCanvas(50, -20);
                        this.sword.rotateCanvas(tween.getValue() as number);
                        this.drawSwordBlade(this.COLORS.swordSwing);
                        this.sword.restore();
                    },
                    onComplete: () => {
                        // Recovery
                        this.scene.tweens.add({
                            targets: { rotation: -1.2 },
                            rotation: 0.3,
                            duration: 150,
                            ease: 'Power2',
                            onUpdate: (tween) => {
                                this.sword.clear();
                                this.sword.save();
                                this.sword.translateCanvas(50, -20);
                                this.sword.rotateCanvas(tween.getValue() as number);
                                this.drawSwordBlade(this.COLORS.sword);
                                this.sword.restore();
                            },
                            onComplete: () => {
                                this.currentState = 'neutral';
                                this.drawSword('neutral');
                            }
                        });
                    }
                });
            }
        });
    }
    
    /**
     * Helper to draw sword blade
     */
    private drawSwordBlade(color: number): void {
        this.sword.lineStyle(3, 0x333333);
        this.sword.fillStyle(color);
        this.sword.fillRect(-5, -60, 10, 50);
        this.sword.strokeRect(-5, -60, 10, 50);
        this.sword.fillStyle(0x8B4513);
        this.sword.fillRect(-15, -12, 30, 8);
        this.sword.fillRect(-4, -5, 8, 25);
    }
    
    /**
     * Visual feedback when player takes a hit
     */
    hit(): void {
        this.currentState = 'hit';
        
        // Flash red
        this.bodyGraphics.clear();
        this.bodyGraphics.lineStyle(3, 0xFF0000);
        this.bodyGraphics.fillStyle(0xFF0000, 0.5);
        this.bodyGraphics.fillRoundedRect(-30, -40, 60, 80, 10);
        this.bodyGraphics.strokeRoundedRect(-30, -40, 60, 80, 10);
        this.bodyGraphics.fillCircle(0, -60, 25);
        this.bodyGraphics.strokeCircle(0, -60, 25);
        
        // Shake
        this.scene.tweens.add({
            targets: this,
            x: this.x + 10,
            duration: 30,
            yoyo: true,
            repeat: 3,
            onComplete: () => {
                this.drawBody();
                this.currentState = 'neutral';
            }
        });
    }
    
    /**
     * Get current zone
     */
    getZone(): BlockZone {
        return this.currentZone;
    }
    
    /**
     * Get current state
     */
    getState(): PlayerState {
        return this.currentState;
    }

    // Legacy compatibility - redirect old method names
    moveShieldToZone(zone: number): void {
        this.moveToZone(zone as BlockZone, false);
    }
}
