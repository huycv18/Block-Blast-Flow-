// ============================================================
// Block Shape Definitions — window.SHAPES
// Each shape: array of [row, col] offsets from anchor (0,0)
// ============================================================

window.SHAPES = {
    // --- Simple shapes (early levels) ---
    DOT:  { name: 'DOT',  cells: [[0,0]], unitCount: 1 },
    I2:   { name: 'I2',   cells: [[0,0],[0,1]], unitCount: 2 },
    I2V:  { name: 'I2V',  cells: [[0,0],[1,0]], unitCount: 2 },
    I3:   { name: 'I3',   cells: [[0,0],[0,1],[0,2]], unitCount: 3 },
    I3V:  { name: 'I3V',  cells: [[0,0],[1,0],[2,0]], unitCount: 3 },
    L2:   { name: 'L2',   cells: [[0,0],[1,0],[1,1]], unitCount: 3 },
    L2R:  { name: 'L2R',  cells: [[0,1],[1,0],[1,1]], unitCount: 3 },

    // --- Tetrominos ---
    O:    { name: 'O',    cells: [[0,0],[0,1],[1,0],[1,1]], unitCount: 4 },
    I4:   { name: 'I4',   cells: [[0,0],[0,1],[0,2],[0,3]], unitCount: 4 },
    I4V:  { name: 'I4V',  cells: [[0,0],[1,0],[2,0],[3,0]], unitCount: 4 },
    T:    { name: 'T',    cells: [[0,0],[0,1],[0,2],[1,1]], unitCount: 4 },
    TD:   { name: 'TD',   cells: [[0,1],[1,0],[1,1],[1,2]], unitCount: 4 },
    TL:   { name: 'TL',   cells: [[0,0],[1,0],[1,1],[2,0]], unitCount: 4 },
    TR:   { name: 'TR',   cells: [[0,1],[1,0],[1,1],[2,1]], unitCount: 4 },
    L:    { name: 'L',    cells: [[0,0],[1,0],[2,0],[2,1]], unitCount: 4 },
    LR:   { name: 'LR',   cells: [[0,0],[0,1],[1,0],[2,0]], unitCount: 4 },
    J:    { name: 'J',    cells: [[0,1],[1,1],[2,0],[2,1]], unitCount: 4 },
    JR:   { name: 'JR',   cells: [[0,0],[0,1],[1,1],[2,1]], unitCount: 4 },
    S:    { name: 'S',    cells: [[0,1],[0,2],[1,0],[1,1]], unitCount: 4 },
    SV:   { name: 'SV',   cells: [[0,0],[1,0],[1,1],[2,1]], unitCount: 4 },
    Z:    { name: 'Z',    cells: [[0,0],[0,1],[1,1],[1,2]], unitCount: 4 },
    ZV:   { name: 'ZV',   cells: [[0,1],[1,0],[1,1],[2,0]], unitCount: 4 },
};

window.ShapeUtils = {
    getBounds(shapeName) {
        const shape = window.SHAPES[shapeName];
        if (!shape) return null;
        let maxR = 0, maxC = 0;
        for (const [r, c] of shape.cells) {
            if (r > maxR) maxR = r;
            if (c > maxC) maxC = c;
        }
        return { rows: maxR + 1, cols: maxC + 1 };
    },
    getCubeCount(shapeName) {
        const shape = window.SHAPES[shapeName];
        if (!shape) return 0;
        return shape.unitCount * CONFIG.CUBES_PER_CELL;
    }
};
