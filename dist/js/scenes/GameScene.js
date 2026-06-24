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
        this.funnel = new Funnel(this);
        this.conveyor = new Conveyor(this);
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

            // Check if pointer is on the board area
            const gridPos = this.screenToGrid(pointer.x, pointer.y);
            if (!gridPos) {
                // If booster targeting, cancel on miss
                if (this.boosterManager.isTargeting()) {
                    this.boosterManager.cancelTargeting();
                }
                return;
            }

            const block = this.board.getBlockAt(gridPos.row, gridPos.col);
            if (!block) return;

            this.handleBlockTap(block);
        });
    }

    async handleBlockTap(block) {
        // Handle booster targeting
        if (this.boosterManager.isTargeting()) {
            const booster = this.boosterManager.getActiveBooster();
            if (booster === 'magnet') {
                await this.boosterManager.useMagnetOn(block, this.board);
            } else if (booster === 'paintGun') {
                await this.boosterManager.usePaintGunOn(
                    block, this.board, this.carManager, this.cubeManager
                );
            }
            return;
        }

        if (block.state === 'covered') return;

        if (block.state === 'blocked') {
            await block.shakeBlocked();
            return;
        }

        if (block.state === 'pullable') {
            this.gameState.setState('ANIMATING');

            // Animation chain: shake → lift → blast → cubes spawn
            await block.shake();
            await block.liftUp();

            // Spawn cubes before blast completes for visual overlap
            const cubes = this.cubeManager.spawnFromBlock(block);

            await block.blast();
            this.board.removeBlock(block);

            // Camera micro-shake
            this.cameras.main.shake(80, 0.005);

            // Wait for cubes to settle then unlock input
            this.time.delayedCall(1000, () => {
                if (this.gameState.getState() !== 'WIN' &&
                    this.gameState.getState() !== 'LOSE') {
                    this.gameState.setState('PLAYING');
                }

                // Check win/lose
                this.gameState.checkWinCondition(
                    this.board, this.conveyor, this.funnel
                );
            });
        }
    }

    screenToGrid(screenX, screenY) {
        const col = Math.floor((screenX - CONFIG.BOARD_OFFSET_X) / CONFIG.CELL_SIZE);
        const row = Math.floor((screenY - CONFIG.BOARD_OFFSET_Y) / CONFIG.CELL_SIZE);
        if (row < 0 || row >= CONFIG.GRID_ROWS ||
            col < 0 || col >= CONFIG.GRID_COLS) return null;
        return { row, col };
    }

    update(time, delta) {
        const state = this.gameState.getState();
        if (state === 'WIN' || state === 'LOSE' || state === 'IDLE') return;

        // Update systems
        if (this.cubeManager) this.cubeManager.update();
        if (this.funnel) this.funnel.update(this.conveyor);
        if (this.conveyor) this.conveyor.update(delta, this.carManager);

        // Check lose condition
        if (state === 'PLAYING') {
            this.gameState.checkLoseCondition(this.conveyor, this.carManager);
        }

        // Cleanup phase: check if done
        if (state === 'CLEANUP') {
            if (this.conveyor.getCurrentLoad() === 0 &&
                this.funnel.getCubeCount() === 0) {
                // Check if any cubes still in physics
                const physicsCubes = this.cubeManager.getCubesByState('PHYSICS');
                const drainingCubes = this.cubeManager.getCubesByState('DRAINING');
                if (physicsCubes.length === 0 && drainingCubes.length === 0) {
                    this.gameState.enterWin();
                }
            }
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

    revive() {
        this.gameState.revive(this.conveyor, this.funnel);
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
