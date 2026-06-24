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

    // --- Drawing ---

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

        // Draw arrow indicators in funnel area
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

        // Arrowhead
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = 5;
        g.beginPath();
        g.moveTo(x2, y2);
        g.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
        g.moveTo(x2, y2);
        g.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
        g.strokePath();
    }

    // --- Level Data ---

    createFromLevelData(levelData) {
        for (const layerData of levelData.layers) {
            const layerIndex = layerData.index;
            const layerBlocks = [];

            for (const blockData of layerData.blocks) {
                const block = new Block(this.scene, blockData, layerIndex);
                this.blocks.set(blockData.id, block);
                layerBlocks.push(block);

                // Populate grid
                for (const cell of block.cells) {
                    if (cell.row >= 0 && cell.row < CONFIG.GRID_ROWS &&
                        cell.col >= 0 && cell.col < CONFIG.GRID_COLS) {
                        this.grid[cell.row][cell.col] = {
                            blockId: blockData.id,
                            layerIndex: layerIndex
                        };
                    }
                }
            }

            this.layerMap.set(layerIndex, layerBlocks);
        }

        this.recalculateAllStates();
    }

    // --- State Management ---

    getBlockState(block) {
        let coveredCells = 0;
        const totalCells = block.cells.length;

        for (const cell of block.cells) {
            // Check if any higher-layer block covers this cell
            for (const [layerIdx, layerBlocks] of this.layerMap) {
                if (layerIdx <= block.layer) continue; // Only check higher layers
                for (const otherBlock of layerBlocks) {
                    if (!this.blocks.has(otherBlock.id)) continue; // Already removed
                    for (const otherCell of otherBlock.cells) {
                        if (otherCell.row === cell.row && otherCell.col === cell.col) {
                            coveredCells++;
                            break;
                        }
                    }
                    if (coveredCells > 0 && coveredCells < totalCells) break;
                }
            }
        }

        if (coveredCells === 0) return 'pullable';
        if (coveredCells >= totalCells) return 'covered';
        return 'blocked';
    }

    recalculateAllStates() {
        for (const [id, block] of this.blocks) {
            const newState = this.getBlockState(block);
            block.setState(newState);
        }
    }

    removeBlock(block) {
        // Remove from grid
        for (const cell of block.cells) {
            if (cell.row >= 0 && cell.row < CONFIG.GRID_ROWS &&
                cell.col >= 0 && cell.col < CONFIG.GRID_COLS) {
                const gridCell = this.grid[cell.row][cell.col];
                if (gridCell && gridCell.blockId === block.id) {
                    this.grid[cell.row][cell.col] = null;
                }
            }
        }

        // Remove from layer map
        const layerBlocks = this.layerMap.get(block.layer);
        if (layerBlocks) {
            const idx = layerBlocks.indexOf(block);
            if (idx !== -1) layerBlocks.splice(idx, 1);
        }

        // Remove from blocks map
        this.blocks.delete(block.id);

        // Recalculate states for remaining blocks
        this.recalculateAllStates();
    }

    // --- Queries ---

    getPullableBlocks() {
        const result = [];
        for (const [id, block] of this.blocks) {
            if (block.state === 'pullable') result.push(block);
        }
        return result;
    }

    getVisibleBlocks() {
        const result = [];
        for (const [id, block] of this.blocks) {
            if (block.state === 'pullable' || block.state === 'blocked') result.push(block);
        }
        return result;
    }

    getBlockAt(row, col) {
        // Check all layers, return top-most block
        let topBlock = null;
        let topLayer = -1;
        for (const [id, block] of this.blocks) {
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
        if (this.containerGfx) this.containerGfx.destroy();
        if (this.arrowGfx) this.arrowGfx.destroy();
        for (const sprite of this.gridBgSprites) sprite.destroy();
        for (const [id, block] of this.blocks) block.destroy();
        this.blocks.clear();
        this.layerMap.clear();
    }
};
