// ============================================================
// Level Validator — window.LevelValidator
// Validates level data for cube/car balance, bounds, overlaps
// ============================================================

window.LevelValidator = {

    /**
     * Validate a single level data object.
     * @param {object} levelData — A level definition from window.LEVELS
     * @returns {{ valid: boolean, errors: string[] }}
     */
    validate(levelData) {
        const errors = [];

        if (!levelData) {
            return { valid: false, errors: ['Level data is null or undefined'] };
        }

        const { boardSize, layers, cars } = levelData;
        const cols = boardSize ? boardSize.cols : CONFIG.GRID_COLS;
        const rows = boardSize ? boardSize.rows : CONFIG.GRID_ROWS;

        // ----- 1. Cube count per color === Car capacity per color -----
        const cubesPerColor = {};  // total cubes produced by blocks
        const capacityPerColor = {}; // total car capacity

        if (layers) {
            for (const layer of layers) {
                if (!layer.blocks) continue;
                for (const block of layer.blocks) {
                    const shape = window.SHAPES[block.shape];
                    if (!shape) {
                        errors.push(`Block "${block.id}" references unknown shape "${block.shape}"`);
                        continue;
                    }
                    const cubeCount = shape.unitCount * CONFIG.CUBES_PER_CELL;
                    cubesPerColor[block.color] = (cubesPerColor[block.color] || 0) + cubeCount;
                }
            }
        }

        if (cars) {
            for (const car of cars) {
                capacityPerColor[car.color] = (capacityPerColor[car.color] || 0) + car.capacity;
            }
        }

        // Compare cube totals to car capacity totals
        const allColors = new Set([...Object.keys(cubesPerColor), ...Object.keys(capacityPerColor)]);
        for (const color of allColors) {
            const cubes = cubesPerColor[color] || 0;
            const capacity = capacityPerColor[color] || 0;
            if (cubes !== capacity) {
                errors.push(
                    `Color "${color}": cube count (${cubes}) !== car capacity (${capacity})`
                );
            }
        }

        // ----- 2. All blocks fit within grid bounds -----
        if (layers) {
            for (const layer of layers) {
                if (!layer.blocks) continue;
                for (const block of layer.blocks) {
                    const shape = window.SHAPES[block.shape];
                    if (!shape) continue; // already reported above

                    for (const [dr, dc] of shape.cells) {
                        const r = block.row + dr;
                        const c = block.col + dc;
                        if (r < 0 || r >= rows || c < 0 || c >= cols) {
                            errors.push(
                                `Block "${block.id}" (shape ${block.shape}) at (${block.row},${block.col}): ` +
                                `cell offset [${dr},${dc}] goes out of bounds at (${r},${c})`
                            );
                        }
                    }
                }
            }
        }

        // ----- 3. No same-layer block overlaps -----
        if (layers) {
            for (const layer of layers) {
                if (!layer.blocks) continue;

                const occupied = new Set();
                for (const block of layer.blocks) {
                    const shape = window.SHAPES[block.shape];
                    if (!shape) continue;

                    for (const [dr, dc] of shape.cells) {
                        const r = block.row + dr;
                        const c = block.col + dc;
                        const key = `${r},${c}`;
                        if (occupied.has(key)) {
                            errors.push(
                                `Layer ${layer.index}: overlap at (${r},${c}) — ` +
                                `block "${block.id}" conflicts with another block`
                            );
                        }
                        occupied.add(key);
                    }
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    },

    /**
     * Validate all levels in window.LEVELS and log results.
     * @returns {boolean} true if all levels are valid
     */
    validateAll() {
        if (!window.LEVELS || !Array.isArray(window.LEVELS)) {
            console.error('[LevelValidator] window.LEVELS is not defined or not an array');
            return false;
        }

        let allValid = true;
        for (const level of window.LEVELS) {
            const result = this.validate(level);
            if (!result.valid) {
                allValid = false;
                console.error(`[LevelValidator] Level ${level.id} ("${level.name}") FAILED:`);
                for (const err of result.errors) {
                    console.error(`  - ${err}`);
                }
            } else {
                console.log(`[LevelValidator] Level ${level.id} ("${level.name}") — OK`);
            }
        }
        return allValid;
    },
};
