import Phaser from 'phaser';
import { CombatSystem, RUST_WARDEN_ATTACKS } from '../systems/CombatSystem';

export class PracticeUI extends Phaser.Scene {
    private combat!: CombatSystem;
    private parentScene!: Phaser.Scene;
    private isVisible: boolean = true;
    private container!: Phaser.GameObjects.Container;

    constructor() {
        super({ key: 'PracticeUI' });
    }

    init(data: { combat: CombatSystem, parent: Phaser.Scene }) {
        this.combat = data.combat;
        this.parentScene = data.parent;
    }

    create() {
        // Create container for UI elements
        this.container = this.add.container(0, 0);

        // Semi-transparent background panel (Right side)
        const bg = this.add.rectangle(400, 0, 140, 960, 0x000000, 0.8).setOrigin(0, 0);
        this.container.add(bg);

        // Title
        const title = this.add.text(470, 20, 'PRACTICE\nMODE', {
            fontSize: '20px',
            color: '#00ff00',
            fontFamily: 'Arial',
            align: 'center',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.container.add(title);

        // Instructions
        const subtext = this.add.text(470, 60, '(Invincible)', {
            fontSize: '14px',
            color: '#888888',
            fontFamily: 'Arial'
        }).setOrigin(0.5);
        this.container.add(subtext);

        // Divider
        const line = this.add.line(0, 0, 410, 80, 530, 80, 0x00ff00).setOrigin(0);
        this.container.add(line);

        // Attack Toggles
        let yPos = 100;
        this.add.text(410, yPos, 'ATTACKS:', { fontSize: '16px', color: '#ffffff' });
        yPos += 30;

        RUST_WARDEN_ATTACKS.forEach((attack) => {
            this.createToggle(410, yPos, attack, true);
            yPos += 40;
        });

        // Forced Attack Buttons
        yPos += 20;
        const line2 = this.add.line(0, 0, 410, yPos, 530, yPos, 0x00ff00).setOrigin(0);
        this.container.add(line2);
        yPos += 20;

        this.add.text(410, yPos, 'FORCE:', { fontSize: '16px', color: '#ffffff' });
        yPos += 30;

        RUST_WARDEN_ATTACKS.forEach((attack) => {
            this.createForceButton(410, yPos, attack);
            yPos += 40;
        });

        // Control Buttons
        this.createButton(470, 850, 'RESET BOSS', 0xffff00, () => {
             this.parentScene.scene.restart({ isPractice: true }); // Restart parent with practice flag
        });

        this.createButton(470, 900, 'EXIT MODE', 0xff0000, () => {
             // Restart parent WITHOUT practice flag
             this.parentScene.scene.restart({ isPractice: false });
        });
    }

    private createToggle(x: number, y: number, attack: any, defaultState: boolean) {
        const bg = this.add.rectangle(x, y, 20, 20, 0x333333).setOrigin(0, 0.5).setInteractive();
        const check = this.add.text(x + 3, y - 8, 'X', { color: '#00ff00', fontSize: '16px' }).setVisible(defaultState);
        
        const label = this.add.text(x + 30, y, attack.id.replace('_', ' '), {
            fontSize: '12px',
            color: '#cccccc'
        }).setOrigin(0, 0.5);

        bg.on('pointerdown', () => {
            const newState = !check.visible;
            check.setVisible(newState);
            this.combat.setPracticeAttack(attack.id, newState);
            bg.setFillStyle(newState ? 0x333333 : 0x111111);
        });

        this.container.add([bg, check, label]);
    }

    private createForceButton(x: number, y: number, attack: any) {
        const btn = this.add.rectangle(x, y, 110, 30, 0x333333).setOrigin(0, 0.5).setInteractive();
        const label = this.add.text(x + 55, y, attack.id.replace('_', ' '), {
            fontSize: '12px',
            color: '#ffffff'
        }).setOrigin(0.5);

        btn.on('pointerdown', () => {
            this.combat.forceAttack(attack.id);
            // Visual feedback
            btn.setFillStyle(0x666666);
            this.time.delayedCall(100, () => btn.setFillStyle(0x333333));
        });

        btn.on('pointerover', () => btn.setFillStyle(0x444444));
        btn.on('pointerout', () => btn.setFillStyle(0x333333));

        this.container.add([btn, label]);
    }

    private createButton(x: number, y: number, text: string, color: number, callback: () => void) {
        const btn = this.add.rectangle(x, y, 120, 40, color).setOrigin(0.5).setInteractive();
        const label = this.add.text(x, y, text, {
            fontSize: '14px',
            color: '#000000',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        btn.on('pointerdown', callback);
        btn.on('pointerover', () => btn.setAlpha(0.8));
        btn.on('pointerout', () => btn.setAlpha(1));

        this.container.add([btn, label]);
    }
}
