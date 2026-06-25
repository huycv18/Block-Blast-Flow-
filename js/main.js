// ============================================================
// Block Cube Puzzle — Main Entry Point
// Initializes Phaser 3 game with Matter.js physics
// ============================================================

window.addEventListener('load', () => {
    if (!window.Phaser) {
        const container = document.getElementById('game-container');
        if (container) {
            container.textContent = 'Unable to load the game engine.';
        }
        console.error('Phaser failed to load.');
        return;
    }

    const config = {
        type: Phaser.AUTO,
        width: CONFIG.GAME_WIDTH,
        height: CONFIG.GAME_HEIGHT,
        parent: 'game-container',
        backgroundColor: THEME.BG_CSS,
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.NO_CENTER,
        },
        physics: {
            default: 'matter',
            matter: {
                gravity: { y: CONFIG.GRAVITY_Y },
                debug: false,
            },
        },
        scene: [BootScene, GameScene, UIScene],
    };

    window.game = new Phaser.Game(config);
});
