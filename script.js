const canvas = document.getElementById('gridCanvas');
const ctx = canvas.getContext('2d');
const info = document.getElementById('info');

const GRID_SIZE_MIN = 10, GRID_SIZE_MAX = 40, GRID_SIZE_DEFAULT = 20;
let ROWS = GRID_SIZE_DEFAULT, COLS = GRID_SIZE_DEFAULT;
let CELL_SIZE = canvas.width / COLS;

let grid = [];
let mode = 'setStart'; // setStart, setEnd, addObstacle
let start = null, end = null;
let dijkstraState = null;
let autoRunInterval = null;

let isMouseDown = false;
let dragObstacleState = null; // true for placing, false for removing
let hoverCell = null;

// Grid size controls
const gridSizeRange = document.getElementById('gridSizeRange');
const gridSizeNumber = document.getElementById('gridSizeNumber');

gridSizeRange.addEventListener('input', (e) => {
  gridSizeNumber.value = gridSizeRange.value;
  setGridSize(parseInt(gridSizeRange.value));
});
gridSizeNumber.addEventListener('input', (e) => {
  let val = Math.max(GRID_SIZE_MIN, Math.min(GRID_SIZE_MAX, parseInt(gridSizeNumber.value) || GRID_SIZE_DEFAULT));
  gridSizeNumber.value = val;
  gridSizeRange.value = val;
  setGridSize(val);
});

function setGridSize(size) {
  ROWS = COLS = size;
  CELL_SIZE = canvas.width / COLS;
  resetGrid();
}

function resetGrid() {
  grid = [];
  for (let r = 0; r < ROWS; r++) {
    let row = [];
    for (let c = 0; c < COLS; c++) {
      row.push({
        r, c,
        isStart: false,
        isEnd: false,
        isObstacle: false,
        isVisited: false,
        isPath: false,
        dist: Infinity,
        prev: null
      });
    }
    grid.push(row);
  }
  start = null;
  end = null;
  dijkstraState = null;
  clearInterval(autoRunInterval);
  autoRunInterval = null;
  isMouseDown = false;
  dragObstacleState = null;
  hoverCell = null;
  draw();
  info.textContent = 'Click a cell to set the start point.';
}
// Initialize grid size controls
(function() {
  gridSizeRange.value = GRID_SIZE_DEFAULT;
  gridSizeNumber.value = GRID_SIZE_DEFAULT;
})();
resetGrid();

document.getElementById('setStartBtn').onclick = () => { mode = 'setStart'; info.textContent = 'Click a cell to set the start point.'; };
document.getElementById('setEndBtn').onclick = () => { mode = 'setEnd'; info.textContent = 'Click a cell to set the end point.'; };
document.getElementById('addObstacleBtn').onclick = () => { mode = 'addObstacle'; info.textContent = 'Click or drag to add/remove obstacles.'; };
document.getElementById('nextStepBtn').onclick = () => { nextDijkstraStep(); };
document.getElementById('autoRunBtn').onclick = () => { 
  if (!autoRunInterval) {
    autoRunInterval = setInterval(() => {
      if (!nextDijkstraStep()) clearInterval(autoRunInterval);
    }, 50);
  }
};
document.getElementById('resetBtn').onclick = resetGrid;

canvas.onmousedown = function(e) {
  if (mode !== 'addObstacle') return;
  isMouseDown = true;
  const {r, c} = getCellFromEvent(e);
  if (r === null) return;
  let cell = grid[r][c];
  if (cell.isStart || cell.isEnd) return;
  dragObstacleState = !cell.isObstacle;
  cell.isObstacle = dragObstacleState;
  draw();
};
canvas.onmouseup = function(e) {
  isMouseDown = false;
  dragObstacleState = null;
};
canvas.onmouseleave = function(e) {
  isMouseDown = false;
  dragObstacleState = null;
  hoverCell = null;
  draw();
};
canvas.onmousemove = function(e) {
  const {r, c} = getCellFromEvent(e);
  if (r === null) {
    hoverCell = null;
    draw();
    return;
  }
  hoverCell = {r, c};
  if (isMouseDown && mode === 'addObstacle') {
    let cell = grid[r][c];
    if (cell.isStart || cell.isEnd) return;
    cell.isObstacle = dragObstacleState;
    draw();
  } else {
    draw();
  }
};
canvas.onclick = function(e) {
  const {r, c} = getCellFromEvent(e);
  if (r === null) return;
  let cell = grid[r][c];
  if (mode === 'setStart') {
    if (start) grid[start.r][start.c].isStart = false;
    cell.isStart = true;
    start = cell;
    info.textContent = 'Start set. Now set the end point.';
    mode = 'setEnd';
  } else if (mode === 'setEnd') {
    if (end) grid[end.r][end.c].isEnd = false;
    if (cell.isStart) return;
    cell.isEnd = true;
    end = cell;
    info.textContent = 'End set. Add obstacles or start the algorithm.';
    mode = 'addObstacle';
  } else if (mode === 'addObstacle' && !isMouseDown) {
    if (cell.isStart || cell.isEnd) return;
    cell.isObstacle = !cell.isObstacle;
  }
  draw();
};

function getCellFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  const c = Math.floor(x / CELL_SIZE), r = Math.floor(y / CELL_SIZE);
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return {r: null, c: null};
  return {r, c};
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Subtle grid background
  ctx.save();
  ctx.strokeStyle = '#d1fae5';
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL_SIZE);
    ctx.lineTo(canvas.width, r * CELL_SIZE);
    ctx.stroke();
  }
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL_SIZE, 0);
    ctx.lineTo(c * CELL_SIZE, canvas.height);
    ctx.stroke();
  }
  ctx.restore();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let cell = grid[r][c];
      ctx.beginPath();
      ctx.rect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      if (cell.isStart) ctx.fillStyle = '#10b981';
      else if (cell.isEnd) ctx.fillStyle = '#ef4444';
      else if (cell.isPath) ctx.fillStyle = '#f59e0b';
      else if (cell.isObstacle) ctx.fillStyle = '#374151';
      else if (cell.isVisited) ctx.fillStyle = '#5eead4';
      else ctx.fillStyle = '#fff';
      ctx.fill();
      // Hover effect
      if (hoverCell && hoverCell.r === r && hoverCell.c === c && mode === 'addObstacle') {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#0f766e';
        ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        ctx.restore();
      }
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

function neighbors(cell) {
  const dirs = [[0,1],[1,0],[0,-1],[-1,0]];
  let result = [];
  for (let [dr, dc] of dirs) {
    let nr = cell.r + dr, nc = cell.c + dc;
    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
      let ncell = grid[nr][nc];
      if (!ncell.isObstacle) result.push(ncell);
    }
  }
  return result;
}

function nextDijkstraStep() {
  if (!start || !end) {
    info.textContent = 'Set start and end points first!';
    return false;
  }
  if (!dijkstraState) {
    // Initialize
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      let cell = grid[r][c];
      cell.isVisited = false;
      cell.isPath = false;
      cell.dist = Infinity;
      cell.prev = null;
    }
    start.dist = 0;
    dijkstraState = {
      queue: [start],
      done: false
    };
    draw();
    info.textContent = 'Algorithm started. Press Next Step or Auto Run.';
    return true;
  }
  if (dijkstraState.done) {
    info.textContent = 'Shortest path found!';
    return false;
  }
  // Find node in queue with smallest dist
  dijkstraState.queue.sort((a, b) => a.dist - b.dist);
  let current = null;
  while (dijkstraState.queue.length && dijkstraState.queue[0].isVisited) dijkstraState.queue.shift();
  if (dijkstraState.queue.length) current = dijkstraState.queue.shift();
  if (!current) {
    info.textContent = 'No path found!';
    dijkstraState.done = true;
    return false;
  }
  current.isVisited = true;
  if (current === end) {
    // Reconstruct path
    let path = [];
    let cell = end;
    while (cell) {
      cell.isPath = true;
      path.push(cell);
      cell = cell.prev;
    }
    draw();
    info.textContent = 'Shortest path found!';
    dijkstraState.done = true;
    return false;
  }
  for (let neighbor of neighbors(current)) {
    if (!neighbor.isVisited) {
      let alt = current.dist + 1;
      if (alt < neighbor.dist) {
        neighbor.dist = alt;
        neighbor.prev = current;
        dijkstraState.queue.push(neighbor);
      }
    }
  }
  draw();
  info.textContent = `Visited cell (${current.r}, ${current.c}).`;
  return true;
}