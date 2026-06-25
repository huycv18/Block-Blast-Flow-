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
                sprite: sprite,
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
            cube = { sprite: sprite, body: null, color: null, state: 'INACTIVE', stateTime: 0, vx: 0, vy: 0 };
        }
        cube.color = color;
        cube.sprite.setTexture('cube_' + color);
        cube.sprite.setVisible(true);
        cube.sprite.setAlpha(1);
        cube.sprite.setScale(1);
        cube.state = 'SPAWNING';
        cube.stateTime = Date.now();
        this.active.push(cube);
        return cube;
    }

    release(cube) {
        // Remove Matter body if exists
        if (cube.body) {
            this.scene.matter.world.remove(cube.body);
            cube.body = null;
        }
        cube.sprite.setVisible(false);
        cube.state = 'INACTIVE';
        cube.color = null;
        cube.vx = 0;
        cube.vy = 0;

        const idx = this.active.indexOf(cube);
        if (idx !== -1) this.active.splice(idx, 1);
        this.inactive.push(cube);
    }

    spawnFromBlock(block) {
        const cubes = [];
        const cs = CONFIG.CUBE_SIZE;

        for (const cell of block.cells) {
            const cellX = CONFIG.BOARD_OFFSET_X + cell.col * CONFIG.CELL_SIZE + CONFIG.CELL_DRAW / 2;
            const cellY = CONFIG.BOARD_OFFSET_Y + cell.row * CONFIG.CELL_SIZE + CONFIG.CELL_DRAW / 2;

            for (let i = 0; i < CONFIG.CUBES_PER_CELL; i++) {
                const cube = this.acquire(block.color);
                // Offset within cell for variety
                const offX = (i % 2 === 0 ? -1 : 1) * (4 + Math.random() * 4);
                const offY = (i < 2 ? -1 : 1) * (4 + Math.random() * 4);
                cube.sprite.setPosition(cellX + offX, cellY + offY);

                // Random burst velocity (slower for better feel)
                cube.vx = (Math.random() - 0.5) * 150;
                cube.vy = -(60 + Math.random() * 100);

                // After delay, create physics body
                this.scene.time.delayedCall(CONFIG.CUBE_BURST_DELAY, () => {
                    if (cube.state === 'INACTIVE') return; // Already released
                    this.createPhysicsBody(cube);
                });

                cubes.push(cube);
            }
        }
        return cubes;
    }

    createPhysicsBody(cube) {
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
                group: -1, // No cube-cube collision
                category: 0x0002,
                mask: 0x0001, // Only collide with walls (category 0x0001)
            },
        });

        // Apply initial velocity
        this.scene.matter.body.setVelocity(body, {
            x: cube.vx * 0.016,
            y: cube.vy * 0.016
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
                // Apply burst velocity manually (before physics body exists)
                const dt = 0.016;
                cube.sprite.x += cube.vx * dt;
                cube.sprite.y += cube.vy * dt;
                cube.vy += 200 * dt; // Reduced gravity for slower falling
            }
            else if (cube.state === 'PHYSICS' && cube.body) {
                // Sync sprite with physics body
                cube.sprite.setPosition(cube.body.position.x, cube.body.position.y);

                // Fail-safe: if cube falls below funnel bottom, teleport to drain
                if (cube.body.position.y > CONFIG.CONTAINER_FUNNEL_BOTTOM + 20) {
                    this.scene.matter.body.setPosition(cube.body, {
                        x: CONFIG.CONTAINER_X,
                        y: CONFIG.CONTAINER_FUNNEL_BOTTOM - 5
                    });
                    this.scene.matter.body.setVelocity(cube.body, { x: 0, y: 0 });
                }

                // Long-running physics cubes are handed off by Funnel.update().
            }
            else if (cube.state === 'ON_CONVEYOR') {
                // Position managed by Conveyor
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
        return this.active.filter(c => c.state === state);
    }

    clear() {
        for (let i = this.active.length - 1; i >= 0; i--) {
            this.release(this.active[i]);
        }
    }
};
