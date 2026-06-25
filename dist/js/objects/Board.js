// ============================================================
// Board — 8×8 grid with multi-layer blocks + funnel container shape
// ============================================================

window.Board = class Board {
    constructor(scene, levelData) {
        this.scene = scene;
        this.grid = [];
        this.blocks = new Map();
        this.layerMap = new Map();
        this.containerGfx = null;
        this.gridBgSprites = [];
        this.arrowGfx = null;

        // Initialize empty grid
        for (let r = 0; r < CONFIG.GRID_ROWS; r++) {
            this.grid[r] = [];

            for (let c = 0; c < CONFIG.GRID_COLS; c++) {
                this.grid[r][c] = null;
            }
        }

        this.drawContainerShape();
        this.drawGridBackground();
        this.drawFlowArrows();
        this.createFromLevelData(levelData);
    }

    // ----------------------------------------------------------
    // Drawing
    // ----------------------------------------------------------

    drawContainerShape() {
        const g = this.scene.add.graphics();
        this.containerGfx = g;

        const cx = CONFIG.CONTAINER_X;
        const top = CONFIG.CONTAINER_TOP;
        const w = CONFIG.CONTAINER_WIDTH;
        const gridBot = CONFIG.CONTAINER_GRID_BOTTOM;
        const funBot = CONFIG.CONTAINER_FUNNEL_BOTTOM;
        const drainW = CONFIG.FUNNEL_DRAIN_WIDTH;
        const rad = CONFIG.CONTAINER_RADIUS;
        const bw = CONFIG.CONTAINER_BORDER;

        const left = cx - w / 2;
        const right = cx + w / 2;
        const drainLeft = cx - drainW / 2;
        const drainRight = cx + drainW / 2;

        // Fill
        g.fillStyle(THEME.CONTAINER_FILL, 1);
        g.beginPath();
        g.moveTo(left + rad, top);
        g.lineTo(right - rad, top);
        g.arc(right - rad, top + rad, rad, -Math.PI / 2, 0);
        g.lineTo(right, gridBot);
        g.lineTo(drainRight, funBot);
        g.lineTo(drainLeft, funBot);
        g.lineTo(left, gridBot);
        g.arc(left + rad, top + rad, rad, Math.PI, -Math.PI / 2);
        g.closePath();
        g.fillPath();

        // Stroke
        g.lineStyle(bw, THEME.CONTAINER_STROKE, 1);
        g.beginPath();
        g.moveTo(left + rad, top);
        g.lineTo(right - rad, top);
        g.arc(right - rad, top + rad, rad, -Math.PI / 2, 0);
        g.lineTo(right, gridBot);
        g.lineTo(drainRight, funBot);
        g.lineTo(drainLeft, funBot);
        g.lineTo(left, gridBot);
        g.arc(left + rad, top + rad, rad, Math.PI, -Math.PI / 2);
        g.closePath();
        g.strokePath();

        g.setDepth(0);
    }

    drawGridBackground() {
        for (let r = 0; r < CONFIG.GRID_ROWS; r++) {
            for (let c = 0; c < CONFIG.GRID_COLS; c++) {
                const x = CONFIG.BOARD_OFFSET_X + c * CONFIG.CELL_SIZE + CONFIG.CELL_DRAW / 2;
                const y = CONFIG.BOARD_OFFSET_Y + r * CONFIG.CELL_SIZE + CONFIG.CELL_DRAW / 2;

                const sprite = this.scene.add.image(x, y, 'grid_cell_empty');
                sprite.setDepth(1);

                this.gridBgSprites.push(sprite);
            }
        }
    }

    drawFlowArrows() {
        const g = this.scene.add.graphics();
        this.arrowGfx = g;

        g.setDepth(2);

        const cx = CONFIG.CONTAINER_X;
        const funTop = CONFIG.CONTAINER_GRID_BOTTOM + 5;
        const funBot = CONFIG.CONTAINER_FUNNEL_BOTTOM - 10;
        const midY = (funTop + funBot) / 2;

        g.lineStyle(2, THEME.CONTAINER_STROKE, 0.5);

        // Top row: spreading arrows
        this.drawArrow(g, cx - 30, funTop + 8, cx - 55, funTop + 8);
        this.drawArrow(g, cx + 30, funTop + 8, cx + 55, funTop + 8);

        // Middle: converging arrows
        this.drawArrow(g, cx - 40, midY, cx - 15, midY + 10);
        this.drawArrow(g, cx + 40, midY, cx + 15, midY + 10);

        // Bottom: down arrows
        this.drawArrow(g, cx, midY + 5, cx, funBot);
    }

    drawArrow(g, x1, y1, x2, y2) {
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.strokePath();

        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = 5;

        g.beginPath();
        g.moveTo(x2, y2);
        g.lineTo(
            x2 - headLen * Math.cos(angle - 0.4),
            y2 - headLen * Math.sin(angle - 0.4)
        );
        g.moveTo(x2, y2);
        g.lineTo(
            x2 - headLen * Math.cos(angle + 0.4),
            y2 - headLen * Math.sin(angle + 0.4)
        );
        g.strokePath();
    }

    // ----------------------------------------------------------
    // Level Data
    // ----------------------------------------------------------

    createFromLevelData(levelData) {
        for (const layerData of levelData.layers) {
            const layerIndex = layerData.index;
            const layerBlocks = [];

            for (const blockData of layerData.blocks) {
                const block = new Block(this.scene, blockData, layerIndex);

                this.blocks.set(blockData.id, block);
                layerBlocks.push(block);

                for (const cell of block.cells) {
                    if (
                        cell.row >= 0 &&
                        cell.row < CONFIG.GRID_ROWS &&
                        cell.col >= 0 &&
                        cell.col < CONFIG.GRID_COLS
                    ) {
                        this.grid[cell.row][cell.col] = {
                            blockId: blockData.id,
                            layerIndex,
                        };
                    }
                }
            }

            this.layerMap.set(layerIndex, layerBlocks);
        }

        this.recalculateAllStates();
    }

    // ----------------------------------------------------------
    // State Management
    // ----------------------------------------------------------

    getBlockState(block) {
        let coveredCells = 0;
        const totalCells = block.cells.length;

        for (const cell of block.cells) {
            let coveredThisCell = false;

            for (const [layerIdx, layerBlocks] of this.layerMap) {
                if (layerIdx <= block.layer) continue;

                for (const otherBlock of layerBlocks) {
                    if (!this.blocks.has(otherBlock.id)) continue;

                    for (const otherCell of otherBlock.cells) {
                        if (otherCell.row === cell.row && otherCell.col === cell.col) {
                            coveredThisCell = true;
                            break;
                        }
                    }

                    if (coveredThisCell) break;
                }

                if (coveredThisCell) break;
            }

            if (coveredThisCell) {
                coveredCells++;
            }
        }

        if (coveredCells === 0) return 'pullable';
        if (coveredCells >= totalCells) return 'covered';

        return 'blocked';
    }

    /**
     * Important:
     * Overlay must be based on visual depth relative to the current top visible layer,
     * not the raw layer index from level data.
     *
     * Example:
     * - Level has only one layer with index 2.
     * - Raw layer index = 2 would incorrectly use LAYER_OVERLAYS[2].
     * - Relative visual depth = 0, so no dark overlay.
     */
    updateVisualLayerDepths(stateMap = null) {
        const visibleBlocks = [];

        for (const [id, block] of this.blocks) {
            if (!block) continue;

            const state = stateMap ? stateMap.get(block) : block.state;

            if (state === 'covered') continue;

            visibleBlocks.push(block);
        }

        if (visibleBlocks.length === 0) return;

        const topLayer = Math.max(...visibleBlocks.map(block => block.layer || 0));

        for (const block of visibleBlocks) {
            block.visualLayerDepth = Math.max(0, topLayer - (block.layer || 0));
        }

        // Covered blocks can keep any value, but 0 is safer when they become visible later.
        for (const [id, block] of this.blocks) {
            if (!visibleBlocks.includes(block)) {
                block.visualLayerDepth = 0;
            }
        }
    }

    recalculateAllStates() {
        const stateMap = new Map();

        for (const [id, block] of this.blocks) {
            const newState = this.getBlockState(block);
            stateMap.set(block, newState);
        }

        this.updateVisualLayerDepths(stateMap);

        for (const [id, block] of this.blocks) {
            const newState = stateMap.get(block);

            // force = true để overlay được refresh kể cả khi state không đổi.
            block.setState(newState, true);
        }
    }

    removeBlock(block) {
        for (const cell of block.cells) {
            if (
                cell.row >= 0 &&
                cell.row < CONFIG.GRID_ROWS &&
                cell.col >= 0 &&
                cell.col < CONFIG.GRID_COLS
            ) {
                const gridCell = this.grid[cell.row][cell.col];

                if (gridCell && gridCell.blockId === block.id) {
                    this.grid[cell.row][cell.col] = null;
                }
            }
        }

        const layerBlocks = this.layerMap.get(block.layer);

        if (layerBlocks) {
            const idx = layerBlocks.indexOf(block);

            if (idx !== -1) {
                layerBlocks.splice(idx, 1);
            }
        }

        this.blocks.delete(block.id);

        this.recalculateAllStates();
    }

    // ----------------------------------------------------------
    // Queries
    // ----------------------------------------------------------

    getPullableBlocks() {
        const result = [];

        for (const [id, block] of this.blocks) {
            if (block.state === 'pullable') {
                result.push(block);
            }
        }

        return result;
    }

    getVisibleBlocks() {
        const result = [];

        for (const [id, block] of this.blocks) {
            if (block.state === 'pullable' || block.state === 'blocked') {
                result.push(block);
            }
        }

        return result;
    }

    getBlockAt(row, col) {
        let topBlock = null;
        let topLayer = -Infinity;

        for (const [id, block] of this.blocks) {
            if (block.state === 'covered') continue;

            for (const cell of block.cells) {
                if (cell.row === row && cell.col === col && block.layer > topLayer) {
                    topBlock = block;
                    topLayer = block.layer;
                }
            }
        }

        return topBlock;
    }

    isEmpty() {
        return this.blocks.size === 0;
    }

    destroy() {
        if (this.containerGfx) {
            this.containerGfx.destroy();
            this.containerGfx = null;
        }

        if (this.arrowGfx) {
            this.arrowGfx.destroy();
            this.arrowGfx = null;
        }

        for (const sprite of this.gridBgSprites) {
            sprite.destroy();
        }

        this.gridBgSprites = [];

        for (const [id, block] of this.blocks) {
            block.destroy();
        }

        this.blocks.clear();
        this.layerMap.clear();
    }
};