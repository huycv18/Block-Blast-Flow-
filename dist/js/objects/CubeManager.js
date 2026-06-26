// ============================================================
// CubeManager — Object pool for physics cubes
// ============================================================

window.CubeManager = class CubeManager {
    constructor(scene) {
        this.scene = scene;
        this.active = [];
        this.inactive = [];
    }

    preAllocate(count) {
        for (let i = 0; i < count; i++) {
            const sprite = this.scene.add.image(0, 0, 'cube_red');
            sprite.setVisible(false);
            sprite.setDepth(15);

            this.inactive.push({
                sprite,
                body: null,
                color: null,
                state: 'INACTIVE',
                stateTime: 0,
                vx: 0,
                vy: 0,
            });
        }
    }

    acquire(color) {
        let cube;

        if (this.inactive.length > 0) {
            cube = this.inactive.pop();
        } else {
            const sprite = this.scene.add.image(0, 0, 'cube_red');
            sprite.setDepth(15);

            cube = {
                sprite,
                body: null,
                color: null,
                state: 'INACTIVE',
                stateTime: 0,
                vx: 0,
                vy: 0,
            };
        }

        cube.color = color;
        cube.sprite.setTexture('cube_' + color);
        cube.sprite.setVisible(true);
        cube.sprite.setAlpha(1);
        cube.sprite.setScale(1);
        cube.state = 'SPAWNING';
        cube.stateTime = Date.now();
        cube.vx = 0;
        cube.vy = 0;

        this.active.push(cube);

        return cube;
    }

    release(cube) {
        if (!cube) return;

        // Kill all tweens that may still move this cube into conveyor/car.
        if (cube.sprite && cube.sprite.scene) {
            this.scene.tweens.killTweensOf(cube.sprite);
        }

        if (cube.body) {
            this.scene.matter.world.remove(cube.body);
            cube.body = null;
        }

        if (cube.sprite) {
            cube.sprite.setVisible(false);
            cube.sprite.setAlpha(1);
            cube.sprite.setScale(1);
            cube.sprite.setPosition(-9999, -9999);
        }

        cube.state = 'INACTIVE';
        cube.color = null;
        cube.vx = 0;
        cube.vy = 0;
        cube.stateTime = 0;

        const idx = this.active.indexOf(cube);

        if (idx !== -1) {
            this.active.splice(idx, 1);
        }

        if (!this.inactive.includes(cube)) {
            this.inactive.push(cube);
        }
    }

    spawnFromBlock(block) {
        const cubes = [];

        for (const cell of block.cells) {
            const cellX = CONFIG.BOARD_OFFSET_X + cell.col * CONFIG.CELL_SIZE + CONFIG.CELL_DRAW / 2;
            const cellY = CONFIG.BOARD_OFFSET_Y + cell.row * CONFIG.CELL_SIZE + CONFIG.CELL_DRAW / 2;

            const cubesPerCell = CONFIG.CUBES_PER_CELL || 4;
            const burstRadius = Math.max(5, CONFIG.CELL_SIZE * 0.22);

            for (let i = 0; i < cubesPerCell; i++) {
                const cube = this.acquire(block.color);

                const angle = (Math.PI * 2 * i) / cubesPerCell;
                const jitter = 0.75 + Math.random() * 0.35;
                const offX = Math.cos(angle) * burstRadius * jitter;
                const offY = Math.sin(angle) * burstRadius * jitter;

                cube.sprite.setPosition(cellX + offX, cellY + offY);

                cube.vx = Math.cos(angle) * 120 + (Math.random() - 0.5) * 45;
                cube.vy = Math.sin(angle) * 80 - (70 + Math.random() * 70);

                this.scene.time.delayedCall(CONFIG.CUBE_BURST_DELAY, () => {
                    if (!cube || cube.state === 'INACTIVE') return;
                    this.createPhysicsBody(cube);
                });

                cubes.push(cube);
            }
        }

        return cubes;
    }

    createPhysicsBody(cube) {
        if (!cube || cube.state === 'INACTIVE') return;
        if (!cube.sprite || !cube.sprite.scene) return;

        const x = cube.sprite.x;
        const y = cube.sprite.y;
        const cs = CONFIG.CUBE_SIZE;

        const body = this.scene.matter.add.rectangle(x, y, cs, cs, {
            restitution: CONFIG.CUBE_RESTITUTION,
            friction: CONFIG.CUBE_FRICTION,
            frictionStatic: CONFIG.CUBE_FRICTION_STATIC,
            frictionAir: CONFIG.CUBE_FRICTION_AIR,
            density: CONFIG.CUBE_DENSITY,
            linearDamping: CONFIG.CUBE_LINEAR_DAMPING,
            collisionFilter: {
                group: -1,
                category: 0x0002,
                mask: 0x0001,
            },
        });

        this.scene.matter.body.setVelocity(body, {
            x: cube.vx * 0.016,
            y: cube.vy * 0.016,
        });

        cube.body = body;
        cube.state = 'PHYSICS';
        cube.stateTime = Date.now();
    }

    update() {
        const now = Date.now();

        for (let i = this.active.length - 1; i >= 0; i--) {
            const cube = this.active[i];

            if (cube.state === 'SPAWNING') {
                const dt = 0.016;

                cube.sprite.x += cube.vx * dt;
                cube.sprite.y += cube.vy * dt;
                cube.vy += 200 * dt;
            }

            else if (cube.state === 'PHYSICS' && cube.body) {
                cube.sprite.setPosition(cube.body.position.x, cube.body.position.y);

                if (cube.body.position.y > CONFIG.CONTAINER_FUNNEL_BOTTOM + 20) {
                    this.scene.matter.body.setPosition(cube.body, {
                        x: CONFIG.CONTAINER_X,
                        y: CONFIG.CONTAINER_FUNNEL_BOTTOM - 5,
                    });

                    this.scene.matter.body.setVelocity(cube.body, {
                        x: 0,
                        y: 0,
                    });
                }
            }

            else if (cube.state === 'ON_CONVEYOR') {
                // Conveyor controls the position.
            }

            else if (cube.state === 'DONE') {
                this.release(cube);
            }
        }
    }

    getActiveCubes() {
        return this.active;
    }

    getCubesByState(state) {
        return this.active.filter(cube => cube.state === state);
    }

    /**
     * Revive / cleanup hard clear.
     *
     * This clears:
     * - falling cubes
     * - physics cubes
     * - funnel cubes
     * - draining cubes
     * - conveyor cubes
     * - matching cubes flying into cars
     */
    clear() {
        for (let i = this.active.length - 1; i >= 0; i--) {
            this.release(this.active[i]);
        }
    }
};
