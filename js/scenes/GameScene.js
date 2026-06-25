// ============================================================
// GameScene — Main gameplay scene orchestrating all systems
// ============================================================

window.GameScene = class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    init(data) {
        this.currentLevel = (data && data.levelIndex !== undefined) ? data.levelIndex : 0;
    }

    create() {
        // Check if launched from editor play-test
        const params = new URLSearchParams(window.location.search);

        if (params.get('testLevel')) {
            try {
                const json = localStorage.getItem('editorTestLevel');

                if (json) {
                    const testLevel = JSON.parse(json);
                    console.log('[GameScene] Loading test level from editor:', testLevel.name);
                    this.loadLevel(testLevel);
                    return;
                }
            } catch (e) {
                console.warn('[GameScene] Failed to load test level:', e);
            }
        }

        // Check if custom levels exist in localStorage
        try {
            const customLevels = localStorage.getItem('customLevels');

            if (customLevels) {
                const parsed = JSON.parse(customLevels);

                if (Array.isArray(parsed) && parsed.length > 0) {
                    window.LEVELS = parsed;
                    console.log('[GameScene] Loaded', parsed.length, 'custom levels from localStorage');
                }
            }
        } catch (e) {
            // ignore
        }

        // Check if specific level index is requested via URL (?level=N)
        const levelParam = params.get('level');

        if (levelParam !== null) {
            const parsedLevel = parseInt(levelParam, 10);

            if (!isNaN(parsedLevel) && parsedLevel >= 0 && parsedLevel < LEVELS.length) {
                this.currentLevel = parsedLevel;
            }
        }

        this.loadLevel(LEVELS[this.currentLevel]);
    }

    loadLevel(levelData) {
        if (!levelData) {
            console.error('No level data for index', this.currentLevel);
            return;
        }

        // Validate level
        const validation = LevelValidator.validate(levelData);

        if (!validation.valid) {
            console.error('Level validation failed:', validation.errors);
        }

        // Create systems in order
        this.board = new Board(this, levelData);
        this.funnel = new Funnel(this, levelData.funnelCapacity);
        this.conveyor = new Conveyor(this, levelData.conveyorCapacity);
        this.road = new Road(this);
        this.carManager = new CarManager(this, levelData.cars);
        this.cubeManager = new CubeManager(this);
        this.cubeManager.preAllocate(CONFIG.CUBE_POOL_SIZE);
        this.gameState = new GameStateManager(this);
        this.boosterManager = new BoosterManager(this, levelData.boosters);

        // Listen for car full events
        this.events.on('carFull', (car) => {
            this.carManager.onCarFull(car);
        });

        // Setup input
        this.setupInput();

        // Start playing
        this.gameState.setState('PLAYING');

        // Launch UI overlay
        this.scene.launch('UIScene', { gameScene: this });
    }

    setupInput() {
        this.input.on('pointerdown', (pointer) => {
            if (this.gameState.isInputLocked()) return;

            const gridPos = this.screenToGrid(pointer.x, pointer.y);

            if (!gridPos) {
                if (this.boosterManager?.isTargeting()) {
                    this.boosterManager.cancelTargeting();
                }
                return;
            }

            const block = this.board.getBlockAt(gridPos.row, gridPos.col);

            if (!block) {
                if (this.boosterManager?.isTargeting()) {
                    this.boosterManager.cancelTargeting();
                }
                return;
            }

            // Booster targeting: always immediate tap, no hold
            if (this.boosterManager?.isTargeting()) {
                this.handleBlockTap(block);
                return;
            }

            // Track for tap-vs-hold distinction
            this._heldBlock    = block;
            this._holdXRayOn   = false;

            // After delay → activate X-Ray peek on this block
            this._holdTimer = this.time.delayedCall(
                CONFIG.XRAY_HOLD_DELAY ?? 280,
                () => {
                    if (this._heldBlock === block) {
                        this._holdXRayOn = true;
                        this.board.setXRayModeForBlock(block, true);
                    }
                }
            );
        });

        this.input.on('pointerup', () => {
            if (this._holdTimer) {
                this._holdTimer.remove();
                this._holdTimer = null;
            }

            const block = this._heldBlock;
            this._heldBlock = null;

            if (this._holdXRayOn) {
                // Long hold: restore X-Ray, no tap
                this._holdXRayOn = false;
                if (block) this.board.setXRayModeForBlock(block, false);
            } else if (block) {
                // Quick tap: handle normally
                this.handleBlockTap(block);
            }
        });

        // Cancel hold if pointer leaves the canvas
        this.input.on('pointerout', () => {
            if (this._holdTimer) {
                this._holdTimer.remove();
                this._holdTimer = null;
            }
            if (this._holdXRayOn && this._heldBlock) {
                this._holdXRayOn = false;
                this.board.setXRayModeForBlock(this._heldBlock, false);
            }
            this._heldBlock = null;
        });
    }

    async handleBlockTap(block) {
        if (!block || block.isResolving) return;

        // Handle booster targeting
        if (this.boosterManager.isTargeting()) {
            const booster = this.boosterManager.getActiveBooster();

            if (booster === 'magnet') {
                await this.boosterManager.useMagnetOn(block, this.board);
            } else if (booster === 'paintGun') {
                await this.boosterManager.usePaintGunOn(
                    block,
                    this.board,
                    this.carManager,
                    this.cubeManager
                );
            }

            return;
        }

        if (block.state === 'covered') return;

        if (block.isLocked) {
            await block.shakeLocked();
            return;
        }

        if (block.isFrozen && block.isFrozen()) {
            await block.shakeFrozen();
            return;
        }

        if (block.state === 'blocked') {
            await block.shakeBlocked();
            return;
        }

        if (block.state === 'pullable') {
    block.isResolving = true;
    this.gameState.setState('ANIMATING');

    // Lấy snapshot TRƯỚC khi remove block.
    // Frozen Block vừa được reveal bởi lượt phá này sẽ chưa bị giảm số.
    const frozenCountdownTargets = this.board.getFrozenCountdownTargets
        ? this.board.getFrozenCountdownTargets()
        : [];

    // Animation chain: shake → lift → blast → cubes spawn
    await block.shake();
    await block.liftUp();

    // Spawn cubes before blast completes for visual overlap
    this.cubeManager.spawnFromBlock(block);

    this.board.removeBlock(block);
    if (block.keyColor && this.board.activateKey) {
        this.board.activateKey(block.keyColor, block);
    }
    block.blast();

    // Chỉ giảm số những Frozen Block đã reveal từ trước lượt blast này.
    if (this.board.decreaseFrozenCounts) {
        this.board.decreaseFrozenCounts(1, {
            animate: true,
            targets: frozenCountdownTargets,
        });
    }

    // Camera micro-shake
    this.cameras.main.shake(80, 0.005);

    this.resolvePostBoardChange();
}
    }

    setXRayMode(isOn) {
        if (this.board) this.board.setXRayMode(isOn);
    }

    resolvePostBoardChange() {
        if (!this.gameState ||
            this.gameState.getState() === 'WIN' ||
            this.gameState.getState() === 'LOSE') {
            return;
        }

        if (this.board.isEmpty()) {
            if (!this.gameState.checkWinCondition(this.board, this.carManager)) {
                this.gameState.enterCleanup(this.conveyor);
            }

            return;
        }

        this.gameState.setState('PLAYING');
    }

    screenToGrid(screenX, screenY) {
        const col = Math.floor((screenX - CONFIG.BOARD_OFFSET_X) / CONFIG.CELL_SIZE);
        const row = Math.floor((screenY - CONFIG.BOARD_OFFSET_Y) / CONFIG.CELL_SIZE);

        if (row < 0 || row >= CONFIG.GRID_ROWS ||
            col < 0 || col >= CONFIG.GRID_COLS) {
            return null;
        }

        return { row, col };
    }

    update(time, delta) {
        const state = this.gameState.getState();

        if (state === 'WIN' || state === 'LOSE' || state === 'IDLE') return;

        // Update systems
        if (this.cubeManager) this.cubeManager.update();
        if (this.funnel) this.funnel.update(this.conveyor);
        if (this.conveyor) this.conveyor.update(delta, this.carManager);

        // GDD: WIN = Board empty + Cars clear.
        // When the board is empty, input stays locked in CLEANUP while remaining cubes fill cars.
        if (this.board.isEmpty()) {
            if (this.gameState.checkWinCondition(this.board, this.carManager)) return;

            if (state !== 'CLEANUP') {
                this.gameState.enterCleanup(this.conveyor);
                return;
            }
        }

        // Lose can happen in PLAYING or CLEANUP if the cube/car flow is stuck.
        if (state === 'PLAYING' || state === 'CLEANUP') {
            this.gameState.checkLoseCondition(
                this.conveyor,
                this.carManager,
                this.board,
                this.funnel,
                this.cubeManager
            );
        }
    }

    nextLevel() {
        this.cleanup();
        this.currentLevel++;

        if (this.currentLevel < LEVELS.length) {
            this.scene.restart({ levelIndex: this.currentLevel });
        } else {
            this.currentLevel = LEVELS.length - 1;
            this.scene.restart({ levelIndex: this.currentLevel });
        }
    }

    retryLevel() {
        this.cleanup();
        this.scene.restart({ levelIndex: this.currentLevel });
    }

    async revive() {
    await this.gameState.revive({
        conveyor: this.conveyor,
        funnel: this.funnel,
        cubeManager: this.cubeManager,
        carManager: this.carManager,
        boosterManager: this.boosterManager,
    });
}

    cleanup() {
        this.scene.stop('UIScene');
        this.events.removeAllListeners('carFull');

        if (this.board) this.board.destroy();
        if (this.funnel) this.funnel.destroy();
        if (this.conveyor) this.conveyor.destroy();
        if (this.road) this.road.destroy();
        if (this.carManager) this.carManager.destroy();
        if (this.cubeManager) this.cubeManager.clear();
    }

    shutdown() {
        this.cleanup();
    }
};
