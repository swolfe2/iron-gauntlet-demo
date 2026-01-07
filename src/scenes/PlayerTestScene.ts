import Phaser from 'phaser';
import { Player } from '../entities/Player';
import type { BlockZone } from '../entities/Player';

/**
 * PlayerTestScene - Prototype for new Mouse Tracking + Bullseye Mechanic
 * 
 * CORE LOOP:
 * 1. Shield tracks mouse cursor (Passive Block)
 * 2. "Bullseye" target appears randomly in a zone
 * 3. User must click the target to PARRY
 * 4. Accuracy (closeness to center) determines Parry strength
 */
export class PlayerTestScene extends Phaser.Scene {
    private player!: Player;
    private stateText!: Phaser.GameObjects.Text;
    private feedbackText!: Phaser.GameObjects.Text;
    
    // Bullseye System
    private activeTarget?: { x: number, y: number, circle: Phaser.GameObjects.Graphics, zone: BlockZone };
    private zoneBounds: { x: number, width: number }[] = [];
    
    // Boss Dummy for visual reach testing
    private bossDummy!: Phaser.GameObjects.Container;
    private bossRightArm!: Phaser.GameObjects.Graphics;
    private bossLeftArm!: Phaser.GameObjects.Graphics;
    
    constructor() {
        super({ key: 'PlayerTestScene' });
    }

    create(): void {
        this.cameras.main.setBackgroundColor('#1a1a2e');
        
        // --- 1. Create Geometric Boss Dummy (Top Center) ---
        this.createBossDummy();
        
        // --- 2. Zones & Player (Bottom) ---
        const width = this.scale.width;
        const height = this.scale.height;
        const blockHeight = height * 0.7;
        const zoneWidth = width / 3;
        
        // Define zone bounds for tracking and spawning
        for (let i = 0; i < 3; i++) {
            this.zoneBounds.push({ x: i * zoneWidth, width: zoneWidth });
            
            // Visual guides (faint)
            this.add.rectangle(i * zoneWidth + zoneWidth/2, blockHeight/2, zoneWidth-2, blockHeight, 0x4682B4, 0.1);
            this.add.text(i * zoneWidth + zoneWidth/2, 50, ['LEFT', 'CENTER', 'RIGHT'][i], { 
                fontSize: '14px', color: '#666'
            }).setOrigin(0.5).setAlpha(0.5);
        }
        
        // Create player at bottom of screen (Punchout style)
        this.player = new Player(this, 270, 800);
        
        // UI
        this.add.text(270, 30, 'MOUSE TRACKING + BULLSEYE', {
            fontSize: '24px', color: '#d4af37', fontFamily: 'Arial Black'
        }).setOrigin(0.5);
        
        this.stateText = this.add.text(270, 100, 'Boss: IDLE', {
            fontSize: '20px', color: '#fff'
        }).setOrigin(0.5);
        
        this.feedbackText = this.add.text(270, 400, '', {
            fontSize: '20px', color: '#aaa', stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5);
        
        // Interactive PROVOKE button for mouse users
        const provokeBtn = this.add.text(270, 450, '[ PROVOKE ATTACK ]', {
            fontSize: '24px', 
            color: '#FF4444', 
            backgroundColor: '#330000',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive();
        
        provokeBtn.on('pointerdown', () => {
             this.performBossAttack();
        });
        provokeBtn.on('pointerover', () => provokeBtn.setColor('#FF8888'));
        provokeBtn.on('pointerout', () => provokeBtn.setColor('#FF4444'));
        
        // Instructions
        this.add.text(270, 850, 'MOVE mouse to Block\nCLICK Gold Targets to Parry\nSpace: Spawn Target', {
            fontSize: '16px', color: '#aaa', align: 'center'
        }).setOrigin(0.5);
        
        // Input Handling
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            // Allow tracking across full screen height since targets are low now
            this.handleShieldTracking(pointer.x);
        });
        
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            this.handleParryAttempt(pointer.x, pointer.y);
        });
        
        // Spacebar triggers Boss Attack Loop
        this.input.keyboard?.on('keydown-SPACE', () => {
            console.log('[PlayerTestScene] Spacebar pressed');
            this.performBossAttack();
        });
        
        // Force initial tracking update
        this.handleShieldTracking(this.scale.width / 2);
    }
    
    /**
     * Passive Block: Shield follows mouse zone
     */
    private handleShieldTracking(mouseX: number): void {
        const zoneWidth = this.scale.width / 3;
        const zoneIndex = Math.floor(mouseX / zoneWidth);
        const zone = Phaser.Math.Clamp(zoneIndex, 0, 2) as BlockZone;
        
        // Only update if not currently parrying animation
        if (this.player.getState() !== 'parrying') {
            this.player.moveToZone(zone, false);
            this.stateText.setText(`Blocking: ${['LEFT', 'CENTER', 'RIGHT'][zone]}`);
        }
    }
    
    /**
     * Spawn a Bullseye target in a specific zone
     */
    private spawnBullseye(zone: BlockZone): void {
        // Remove existing
        if (this.activeTarget) {
            this.activeTarget.circle.destroy();
        }
        
        const bounds = this.zoneBounds[zone];
        // Center target in zone X
        const x = bounds.x + bounds.width / 2;
        // Impact height matches player shield/head (approx Y=750)
        const y = 750 + Phaser.Math.Between(-20, 20); 
        
        const circle = this.add.graphics();
        this.drawBullseye(circle, x, y);
        
        // Ensure Target is above Player
        circle.setDepth(10);

        this.activeTarget = { x, y, circle, zone };
        
        // Auto-expire after 1 second (missed window)
        this.time.delayedCall(1000, () => {
            if (this.activeTarget && this.activeTarget.circle === circle) {
                this.activeTarget.circle.destroy();
                this.activeTarget = undefined;
                this.showFeedback('MISSED!', '#FF0000');
            }
        });
        
        this.showFeedback('TARGET!', '#FFFFFF');
    }
    
    private drawBullseye(g: Phaser.GameObjects.Graphics, x: number, y: number) {
        g.clear();
        // Outer glow
        g.fillStyle(0xFFD700, 0.3);
        g.fillCircle(x, y, 40);
        // Middle ring
        g.lineStyle(3, 0xFFD700);
        g.strokeCircle(x, y, 25);
        // Bullseye center
        g.fillStyle(0xFFFFFF);
        g.fillCircle(x, y, 8);
    }
    
    /**
     * Check click accuracy against active target
     */
    private handleParryAttempt(mouseX: number, mouseY: number): void {
        if (!this.activeTarget) {
            // Clicked with no target - just an attack or failed parry?
            // For now, treat as whiff
            return;
        }
        
        const dist = Phaser.Math.Distance.Between(mouseX, mouseY, this.activeTarget.x, this.activeTarget.y);
        const maxRadius = 40;
        
        if (dist <= maxRadius) {
            // HIT! Calculate accuracy
            const accuracy = 1 - (dist / maxRadius); // 0.0 to 1.0
            let rating = 'GOOD';
            let damage = 100;
            
            if (accuracy > 0.9) { 
                rating = 'PERFECT!'; 
                damage = 300; 
            } else if (accuracy > 0.5) {
                rating = 'GREAT';
                damage = 150;
            }
            
            // Trigger Player Parry
            this.player.moveToZone(this.activeTarget.zone, true);
            
            // Visuals
            this.showFeedback(`${rating}\n+${damage}% DMG`, '#FFD700');
            
            // Cleanup
            this.activeTarget.circle.destroy();
            this.activeTarget = undefined;
        } else {
            // Whiffed
            this.showFeedback('WHIFF', '#888');
        }
    }
    
    private showFeedback(text: string, color: string): void {
        this.feedbackText.setText(text);
        this.feedbackText.setColor(color);
        this.feedbackText.setAlpha(1);
        this.feedbackText.setScale(1);
        
        // Pop animation
        this.tweens.add({
            targets: this.feedbackText,
            scale: 1.5,
            alpha: 0,
            duration: 500,
            ease: 'Power2'
        });
    }

    private createBossDummy(): void {
        this.bossDummy = this.add.container(270, 200);
        
        const body = this.add.graphics();
        // RUST WARDEN COLORS
        body.fillStyle(0x8B4513); // SaddleBrown (Rust)
        body.fillRoundedRect(-60, -80, 120, 140, 10);
        body.lineStyle(4, 0xC0C0C0); // Silver Trim
        body.strokeRoundedRect(-60, -80, 120, 140, 10);
        
        // Helmet / Head
        body.fillStyle(0x555555); // Dark Grey Helmet
        body.fillCircle(0, -90, 30);
        body.strokeCircle(0, -90, 30);
        
        // Glowing Eye Slit
        body.fillStyle(0x00FFFF); // Cyan Glow
        body.fillRect(-15, -95, 30, 6);
        
        // Shoudlers
        body.fillStyle(0xA0522D); // Sienna
        body.fillCircle(-70, -60, 45); // Right Shoulder
        body.fillCircle(70, -60, 45);  // Left Shoulder
        body.strokeCircle(-70, -60, 45);
        body.strokeCircle(70, -60, 45);
        
        // Right Arm (Mace)
        this.bossRightArm = this.add.graphics();
        this.drawBossRightArm(0x808080); 
        this.bossRightArm.setPosition(-70, -60); 

        // Left Arm (Shield/Gauntlet)
        this.bossLeftArm = this.add.graphics();
        this.drawBossLeftArm(0x606060);
        this.bossLeftArm.setPosition(70, -60);
        
        this.bossDummy.add([body, this.bossRightArm, this.bossLeftArm]);
        this.bossDummy.setScale(1.0); 
    }

    private drawBossRightArm(color: number): void {
        this.bossRightArm.clear();
        this.bossRightArm.lineStyle(4, 0x000000);
        this.bossRightArm.fillStyle(color);
        // Arm
        this.bossRightArm.fillRect(-10, 0, 20, 200); 
        // Mace Head
        this.bossRightArm.fillStyle(0xC0C0C0);
        this.bossRightArm.fillCircle(0, 220, 40);
        this.bossRightArm.strokeCircle(0, 220, 40);
        // Spikes
        this.bossRightArm.fillStyle(0xFF0000);
        this.bossRightArm.fillTriangle(0, 260, -10, 240, 10, 240);
        this.bossRightArm.fillTriangle(-40, 220, -20, 210, -20, 230);
        this.bossRightArm.fillTriangle(40, 220, 20, 210, 20, 230);
    }

    private drawBossLeftArm(color: number): void {
        this.bossLeftArm.clear();
        this.bossLeftArm.lineStyle(4, 0x000000);
        this.bossLeftArm.fillStyle(color);
        // Arm
        this.bossLeftArm.fillRect(-10, 0, 20, 180);
        // Gauntlet / Shield
        this.bossLeftArm.fillStyle(0x555555);
        this.bossLeftArm.fillRect(-25, 150, 50, 60);
        this.bossLeftArm.strokeRect(-25, 150, 50, 60);
    }
    
    /**
     * The "Perspective Lunge" Attack
     * Boss scales up and moves down to simulate coming closer to the screen
     */
    private performBossAttack(forceZone?: BlockZone): void {
        if (this.stateText.text.includes('ATTACKING')) return;

        this.stateText.setText('Boss: ATTACKING!');
        this.feedbackText.setText('');
        
        // Pick a random zone if not forced
        const targetZone = forceZone !== undefined ? forceZone : Phaser.Math.Between(0, 2) as BlockZone;
        
        // Telegraph
        this.tweens.add({
            targets: this.bossDummy,
            y: 180,
            scale: 0.9,
            duration: 400,
            onComplete: () => {
                // Determine attack specifics
                let targetX = 0;
                let activeArm: Phaser.GameObjects.Graphics | null = null;
                let armRotation = 0;

                if (targetZone === 0) {
                    // LEFT ZONE: Boss lunges Left, Swings RIGHT ARM (Cross)
                    targetX = 180;
                    activeArm = this.bossRightArm;
                    armRotation = -45; // Swing IN
                } else if (targetZone === 2) {
                    // RIGHT ZONE: Boss lunges Right, Swings LEFT ARM (Bash)
                    targetX = 360;
                    activeArm = this.bossLeftArm;
                    armRotation = 45; // Swing IN
                } else {
                    // CENTER ZONE: Boss lunges Center, Overhead RIGHT ARM
                    targetX = 270;
                    activeArm = this.bossRightArm;
                    armRotation = 0; 
                }

                // LUNGE
                this.tweens.add({
                    targets: this.bossDummy,
                    x: targetX,
                    y: 450,
                    scale: 1.5,
                    duration: 350,
                    ease: 'Back.in',
                    onUpdate: () => {
                        if (activeArm) activeArm.setRotation(Phaser.Math.DegToRad(armRotation));
                    },
                    onComplete: () => {
                         this.spawnBullseyeAtFist(targetZone, activeArm!);
                         this.cameras.main.shake(100, 0.01);
                         
                         this.time.delayedCall(800, () => {
                             if (activeArm) activeArm.setRotation(0); // Reset arm
                             this.returnBossToNeutral();
                         });
                    }
                });
            }
        });
    }

    private spawnBullseyeAtFist(zone: BlockZone, arm: Phaser.GameObjects.Graphics): void {
        // Calculate world position based on zone with some randomization (Sweet Spot variation)
        // STRICT RULE: Attack Left -> Target Left, etc.
        
        let baseX = 0;
        if (zone === 0) baseX = 180 - 50;      // Left Zone base
        else if (zone === 2) baseX = 360 + 50; // Right Zone base
        else baseX = 270;                      // Center Zone base

        // Add small random variation to make it feel organic (but keep it inside the zone logic)
        const randomX = baseX + Phaser.Math.Between(-20, 20);
        const randomY = 750 + Phaser.Math.Between(-20, 20);
        
        const circle = this.add.graphics();
        this.drawBullseye(circle, randomX, randomY);
        circle.setDepth(20);
        
        this.activeTarget = { x: randomX, y: randomY, circle, zone };
        
        this.time.delayedCall(600, () => {
            if (this.activeTarget && this.activeTarget.circle === circle) {
                this.activeTarget.circle.destroy();
                this.activeTarget = undefined;
                this.showFeedback('BLOCKED', '#4682B4');
            }
        });
    }

    private returnBossToNeutral(): void {
         this.tweens.add({
            targets: this.bossDummy,
            x: 270,
            y: 200,
            scale: 1.0,
            duration: 800,
            ease: 'Power2',
            onComplete: () => {
                this.stateText.setText('Boss: IDLE');
                // this.feedbackText.setText('Space: PROVOKE ATTACK'); // Feedback text removed to keep UI clean
            }
        });
    }
}
