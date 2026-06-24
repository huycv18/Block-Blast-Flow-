// ============================================================
// Level Definitions — window.LEVELS
// Tutorial levels 1–5 with increasing complexity
//
// FORMULA: Each block produces (unitCount × CUBES_PER_CELL) cubes.
//          CUBES_PER_CELL = 4.
//          Total cubes per color MUST equal total car capacity per color.
// ============================================================

window.LEVELS = [

    // ============================================================
    // LEVEL 1 — "First Tap"
    // 2 colors (red, blue), 1 layer, simple shapes (DOT, I2)
    //
    // RED blocks:
    //   b1: DOT (1 unit × 4 = 4 cubes)
    //   b2: I2  (2 units × 4 = 8 cubes)
    //   → Total red cubes = 12
    //
    // BLUE blocks:
    //   b3: DOT (1 unit × 4 = 4 cubes)
    //   b4: I2  (2 units × 4 = 8 cubes)
    //   → Total blue cubes = 12
    //
    // RED cars:  1 car × capacity 8 + 1 car × capacity 4 = 12 ✓
    // BLUE cars: 1 car × capacity 8 + 1 car × capacity 4 = 12 ✓
    // ============================================================
    {
        id: 1,
        name: 'First Tap',
        difficulty: 'Tutorial',
        boardSize: { cols: 8, rows: 8 },
        conveyorCapacity: 40,
        funnelCapacity: 40,
        layers: [
            {
                index: 0,
                blocks: [
                    { id: 'b1', shape: 'DOT', color: 'red',  row: 2, col: 3 },
                    { id: 'b2', shape: 'I2',  color: 'red',  row: 4, col: 2 },
                    { id: 'b3', shape: 'DOT', color: 'blue', row: 2, col: 5 },
                    { id: 'b4', shape: 'I2',  color: 'blue', row: 4, col: 5 },
                ],
            },
        ],
        cars: [
            { column: 0, color: 'red',  capacity: 8, queueOrder: 0 },
            { column: 1, color: 'blue', capacity: 8, queueOrder: 0 },
            { column: 2, color: 'red',  capacity: 4, queueOrder: 0 },
            { column: 0, color: 'blue', capacity: 4, queueOrder: 1 },
        ],
        boosters: { magnet: 10, shuffle: 10, paintGun: 10 },
    },

    // ============================================================
    // LEVEL 2 — "Color Sort"
    // 2 colors (red, blue), 1 layer, 6 blocks (DOT, I2, L2, O)
    //
    // RED blocks:
    //   b1: I2  (2 × 4 = 8)
    //   b2: L2  (3 × 4 = 12)
    //   b3: DOT (1 × 4 = 4)
    //   → Total red cubes = 24
    //
    // BLUE blocks:
    //   b4: O   (4 × 4 = 16)
    //   b5: I2  (2 × 4 = 8)
    //   b6: DOT (1 × 4 = 4)
    //   → Total blue cubes = 28
    //
    // RED cars:  capacity 8 + capacity 8 + capacity 8 = 24 ✓
    // BLUE cars: capacity 8 + capacity 8 + capacity 8 + capacity 4 = 28 ✓
    // ============================================================
    {
        id: 2,
        name: 'Color Sort',
        difficulty: 'Tutorial',
        boardSize: { cols: 8, rows: 8 },
        conveyorCapacity: 40,
        funnelCapacity: 40,
        layers: [
            {
                index: 0,
                blocks: [
                    { id: 'b1', shape: 'I2',  color: 'red',  row: 1, col: 1 },
                    { id: 'b2', shape: 'L2',  color: 'red',  row: 3, col: 0 },
                    { id: 'b3', shape: 'DOT', color: 'red',  row: 6, col: 6 },
                    { id: 'b4', shape: 'O',   color: 'blue', row: 1, col: 5 },
                    { id: 'b5', shape: 'I2',  color: 'blue', row: 5, col: 3 },
                    { id: 'b6', shape: 'DOT', color: 'blue', row: 5, col: 6 },
                ],
            },
        ],
        cars: [
            { column: 0, color: 'red',  capacity: 8, queueOrder: 0 },
            { column: 1, color: 'blue', capacity: 8, queueOrder: 0 },
            { column: 2, color: 'blue', capacity: 8, queueOrder: 0 },
            { column: 0, color: 'red',  capacity: 8, queueOrder: 1 },
            { column: 1, color: 'red',  capacity: 8, queueOrder: 1 },
            { column: 2, color: 'blue', capacity: 8, queueOrder: 1 },
            { column: 0, color: 'blue', capacity: 4, queueOrder: 0 },
        ],
        boosters: { magnet: 10, shuffle: 10, paintGun: 10 },
    },

    // ============================================================
    // LEVEL 3 — "Traffic Jam"
    // 3 colors (red, blue, green), 1 layer, 8 blocks
    // Designed so wrong order can fill conveyor
    //
    // RED blocks:
    //   b1: I2  (2 × 4 = 8)
    //   b2: DOT (1 × 4 = 4)
    //   → Total red = 12
    //
    // BLUE blocks:
    //   b3: L2  (3 × 4 = 12)
    //   b4: I2  (2 × 4 = 8)
    //   b5: DOT (1 × 4 = 4)
    //   → Total blue = 24
    //
    // GREEN blocks:
    //   b6: O   (4 × 4 = 16)
    //   b7: I2  (2 × 4 = 8)
    //   b8: DOT (1 × 4 = 4)
    //   → Total green = 28
    //
    // RED cars:  capacity 8 + capacity 4 = 12 ✓
    // BLUE cars: capacity 8 + capacity 8 + capacity 8 = 24 ✓
    // GREEN cars: capacity 8 + capacity 8 + capacity 8 + capacity 4 = 28 ✓
    // ============================================================
    {
        id: 3,
        name: 'Traffic Jam',
        difficulty: 'Tutorial',
        boardSize: { cols: 8, rows: 8 },
        conveyorCapacity: 40,
        funnelCapacity: 40,
        layers: [
            {
                index: 0,
                blocks: [
                    { id: 'b1', shape: 'I2',  color: 'red',   row: 0, col: 0 },
                    { id: 'b2', shape: 'DOT', color: 'red',   row: 0, col: 4 },
                    { id: 'b3', shape: 'L2',  color: 'blue',  row: 2, col: 1 },
                    { id: 'b4', shape: 'I2',  color: 'blue',  row: 2, col: 5 },
                    { id: 'b5', shape: 'DOT', color: 'blue',  row: 5, col: 0 },
                    { id: 'b6', shape: 'O',   color: 'green', row: 4, col: 3 },
                    { id: 'b7', shape: 'I2',  color: 'green', row: 6, col: 5 },
                    { id: 'b8', shape: 'DOT', color: 'green', row: 7, col: 0 },
                ],
            },
        ],
        cars: [
            { column: 0, color: 'red',   capacity: 8, queueOrder: 0 },
            { column: 1, color: 'blue',  capacity: 8, queueOrder: 0 },
            { column: 2, color: 'green', capacity: 8, queueOrder: 0 },
            { column: 0, color: 'red',   capacity: 4, queueOrder: 1 },
            { column: 1, color: 'blue',  capacity: 8, queueOrder: 1 },
            { column: 2, color: 'green', capacity: 8, queueOrder: 1 },
            { column: 1, color: 'blue',  capacity: 8, queueOrder: 0 },
            { column: 2, color: 'green', capacity: 8, queueOrder: 0 },
            { column: 0, color: 'green', capacity: 4, queueOrder: 0 },
        ],
        boosters: { magnet: 10, shuffle: 10, paintGun: 10 },
    },

    // ============================================================
    // LEVEL 4 — "Layer Cake"
    // 3 colors (red, blue, green), 2 layers
    // Layer 1 (top) partially covers layer 0 (bottom)
    //
    // LAYER 0 (bottom) blocks:
    //   b1: O   red   (4 × 4 = 16)
    //   b2: I2  blue  (2 × 4 = 8)
    //   b3: L2  green (3 × 4 = 12)
    //   b4: I2  red   (2 × 4 = 8)
    //   b5: DOT blue  (1 × 4 = 4)
    //
    // LAYER 1 (top) blocks:
    //   b6: I2  blue  (2 × 4 = 8)
    //   b7: DOT red   (1 × 4 = 4)
    //   b8: I2  green (2 × 4 = 8)
    //   b9: DOT blue  (1 × 4 = 4)
    //
    // Totals:
    //   RED:   16 + 8 + 4 = 28
    //   BLUE:  8 + 4 + 8 + 4 = 24
    //   GREEN: 12 + 8 = 20
    //
    // RED cars:   capacity 8 + 8 + 8 + 4 = 28 ✓
    // BLUE cars:  capacity 8 + 8 + 8 = 24 ✓
    // GREEN cars: capacity 8 + 8 + 4 = 20 ✓
    // ============================================================
    {
        id: 4,
        name: 'Layer Cake',
        difficulty: 'Tutorial',
        boardSize: { cols: 8, rows: 8 },
        conveyorCapacity: 40,
        funnelCapacity: 40,
        layers: [
            {
                index: 0, // bottom layer
                blocks: [
                    { id: 'b1', shape: 'O',   color: 'red',   row: 1, col: 1 },
                    { id: 'b2', shape: 'I2',  color: 'blue',  row: 1, col: 5 },
                    { id: 'b3', shape: 'L2',  color: 'green', row: 4, col: 0 },
                    { id: 'b4', shape: 'I2',  color: 'red',   row: 4, col: 5 },
                    { id: 'b5', shape: 'DOT', color: 'blue',  row: 6, col: 3 },
                ],
            },
            {
                index: 1, // top layer — partially covers layer 0
                blocks: [
                    { id: 'b6', shape: 'I2',  color: 'blue',  row: 1, col: 1 },  // covers b1 partially
                    { id: 'b7', shape: 'DOT', color: 'red',   row: 1, col: 5 },  // covers b2 partially
                    { id: 'b8', shape: 'I2',  color: 'green', row: 4, col: 1 },  // covers b3 partially
                    { id: 'b9', shape: 'DOT', color: 'blue',  row: 4, col: 5 },  // covers b4 partially
                ],
            },
        ],
        cars: [
            { column: 0, color: 'red',   capacity: 8, queueOrder: 0 },
            { column: 1, color: 'blue',  capacity: 8, queueOrder: 0 },
            { column: 2, color: 'green', capacity: 8, queueOrder: 0 },
            { column: 0, color: 'red',   capacity: 8, queueOrder: 1 },
            { column: 1, color: 'blue',  capacity: 8, queueOrder: 1 },
            { column: 2, color: 'green', capacity: 8, queueOrder: 1 },
            { column: 0, color: 'red',   capacity: 8, queueOrder: 0 },
            { column: 1, color: 'blue',  capacity: 8, queueOrder: 0 },
            { column: 2, color: 'green', capacity: 4, queueOrder: 0 },
            { column: 0, color: 'red',   capacity: 4, queueOrder: 1 },
        ],
        boosters: { magnet: 10, shuffle: 10, paintGun: 10 },
    },

    // ============================================================
    // LEVEL 5 — "Rush Hour"
    // 4 colors (red, blue, green, yellow), 2 layers
    // Car queues with queueOrder 0 and 1
    //
    // LAYER 0 (bottom):
    //   b1:  I2  red    (2 × 4 = 8)
    //   b2:  L2  blue   (3 × 4 = 12)
    //   b3:  O   green  (4 × 4 = 16)
    //   b4:  I2  yellow (2 × 4 = 8)
    //   b5:  DOT red    (1 × 4 = 4)
    //   b6:  DOT blue   (1 × 4 = 4)
    //
    // LAYER 1 (top):
    //   b7:  I2  green  (2 × 4 = 8)
    //   b8:  DOT yellow (1 × 4 = 4)
    //   b9:  I2  red    (2 × 4 = 8)
    //   b10: DOT blue   (1 × 4 = 4)
    //
    // Totals:
    //   RED:    8 + 4 + 8 = 20
    //   BLUE:   12 + 4 + 4 = 20
    //   GREEN:  16 + 8 = 24
    //   YELLOW: 8 + 4 = 12
    //
    // RED cars:    capacity 8 + 8 + 4 = 20 ✓
    // BLUE cars:   capacity 8 + 8 + 4 = 20 ✓
    // GREEN cars:  capacity 8 + 8 + 8 = 24 ✓
    // YELLOW cars: capacity 8 + 4 = 12 ✓
    // ============================================================
    {
        id: 5,
        name: 'Rush Hour',
        difficulty: 'Tutorial',
        boardSize: { cols: 8, rows: 8 },
        conveyorCapacity: 40,
        funnelCapacity: 40,
        layers: [
            {
                index: 0, // bottom layer
                blocks: [
                    { id: 'b1',  shape: 'I2',  color: 'red',    row: 0, col: 1 },
                    { id: 'b2',  shape: 'L2',  color: 'blue',   row: 0, col: 5 },
                    { id: 'b3',  shape: 'O',   color: 'green',  row: 3, col: 3 },
                    { id: 'b4',  shape: 'I2',  color: 'yellow', row: 3, col: 0 },
                    { id: 'b5',  shape: 'DOT', color: 'red',    row: 6, col: 7 },
                    { id: 'b6',  shape: 'DOT', color: 'blue',   row: 6, col: 0 },
                ],
            },
            {
                index: 1, // top layer
                blocks: [
                    { id: 'b7',  shape: 'I2',  color: 'green',  row: 3, col: 3 },  // covers b3 partially
                    { id: 'b8',  shape: 'DOT', color: 'yellow', row: 3, col: 0 },  // covers b4 partially
                    { id: 'b9',  shape: 'I2',  color: 'red',    row: 0, col: 1 },  // covers b1
                    { id: 'b10', shape: 'DOT', color: 'blue',   row: 0, col: 5 },  // covers b2 partially
                ],
            },
        ],
        cars: [
            { column: 0, color: 'red',    capacity: 8, queueOrder: 0 },
            { column: 1, color: 'blue',   capacity: 8, queueOrder: 0 },
            { column: 2, color: 'green',  capacity: 8, queueOrder: 0 },
            { column: 0, color: 'yellow', capacity: 8, queueOrder: 0 },
            { column: 1, color: 'green',  capacity: 8, queueOrder: 1 },
            { column: 2, color: 'red',    capacity: 8, queueOrder: 1 },
            { column: 0, color: 'blue',   capacity: 8, queueOrder: 1 },
            { column: 1, color: 'green',  capacity: 8, queueOrder: 0 },
            { column: 2, color: 'red',    capacity: 4, queueOrder: 0 },
            { column: 0, color: 'blue',   capacity: 4, queueOrder: 0 },
            { column: 1, color: 'yellow', capacity: 4, queueOrder: 1 },
        ],
        boosters: { magnet: 10, shuffle: 10, paintGun: 10 },
    },
];
