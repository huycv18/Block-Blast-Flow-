// ============================================================
// Block Cube Puzzle — Main Entry Point
// Initializes Phaser 3 game with Matter.js physics
// ============================================================

window.addEventListener('load', () => {
    const config = {
        type: Phaser.AUTO,
        width: CONFIG.GAME_WIDTH,
        height: CONFIG.GAME_HEIGHT,
        parent: 'game-container',
        backgroundColor: THEME.BG_CSS,
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
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
