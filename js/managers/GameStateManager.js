// ============================================================
// GameStateManager — State machine for game flow
// ============================================================

window.GameStateManager = class GameStateManager {
    constructor(scene) {
        this.scene = scene;
        this.state = 'IDLE';
        this.previousState = null;
    }

    setState(newState) {
        const validTransitions = {
            'IDLE':      ['PLAYING'],
            'PLAYING':   ['ANIMATING', 'CLEANUP', 'LOSE'],
            'ANIMATING': ['PLAYING', 'CLEANUP'],
            'CLEANUP':   ['WIN'],
            'WIN':       ['IDLE'],
            'LOSE':      ['PLAYING', 'IDLE'], // PLAYING via revive, IDLE via retry
        };

        const allowed = validTransitions[this.state];
        if (!allowed || !allowed.includes(newState)) {
            // Allow it anyway for flexibility in prototype
            console.warn(`State transition ${this.state} → ${newState} (non-standard)`);
        }

        this.previousState = this.state;
        this.state = newState;
        this.scene.events.emit('stateChange', newState, this.previousState);
    }

    getState() {
        return this.state;
    }

    isInputLocked() {
        return this.state !== 'PLAYING';
    }

    checkWinCondition(board, conveyor, funnel) {
        if (!board.isEmpty()) return false;

        const convLoad = conveyor.getCurrentLoad();
        const funLoad = funnel.getCubeCount();

        if (convLoad === 0 && funLoad === 0) {
            this.enterWin();
            return true;
        }

        // Board empty but cubes remain → cleanup
        if (this.state !== 'CLEANUP') {
            this.enterCleanup(conveyor);
        }
        return false;
    }

    checkLoseCondition(conveyor, carManager) {
        if (this.state === 'CLEANUP' || this.state === 'WIN' || this.state === 'LOSE') return false;
        if (!conveyor.isFull()) return false;

        // Check if any cube on conveyor can be matched
        const cubeColors = conveyor.getCubeColors();
        if (carManager.canMatchAnyColor(cubeColors)) return false;

        this.enterLose();
        return true;
    }

    enterCleanup(conveyor) {
        this.setState('CLEANUP');
        conveyor.setSpeedMultiplier(CONFIG.CLEANUP_SPEED_MULT);
    }

    enterWin() {
        this.setState('WIN');

        // Camera pulse
        this.scene.cameras.main.flash(300, 255, 255, 255, true);
        this.scene.cameras.main.shake(200, 0.01);

        // Celebration particles
        const cx = CONFIG.GAME_WIDTH / 2;
        const cy = CONFIG.GAME_HEIGHT / 2;
        const emitter = this.scene.add.particles(cx, cy, 'particle_star', {
            speed: { min: 150, max: 400 },
            angle: { min: 0, max: 360 },
            scale: { start: 1, end: 0 },
            lifespan: 1200,
            quantity: 30,
            gravityY: 200,
        });
        emitter.setDepth(50);
        this.scene.time.delayedCall(500, () => emitter.stop());
        this.scene.time.delayedCall(2000, () => emitter.destroy());
    }

    enterLose() {
        this.setState('LOSE');
        this.scene.cameras.main.shake(300, 0.02);
    }

    revive(conveyor, funnel) {
        conveyor.clear();
        funnel.clear();
        this.setState('PLAYING');
    }
};
