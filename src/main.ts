import Phaser from 'phaser';
import { CombatScene } from './scenes/CombatScene';
import { PlayerTestScene } from './scenes/PlayerTestScene';

// Check URL for scene selection
const urlParams = new URLSearchParams(window.location.search);
const sceneName = urlParams.get('scene') || 'player-test'; // Default to player test

// Game configuration
const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO, // WebGL if available, Canvas fallback
    width: 540,
    height: 960,
    parent: 'app',
    backgroundColor: '#1a1a2e',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: sceneName === 'combat' ? [CombatScene] : [PlayerTestScene, CombatScene]
};

// Create the game
const game = new Phaser.Game(config);

export default game;
