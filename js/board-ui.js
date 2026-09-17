function createBoardElement(board, options = {}) {
  const {
    interactive = false,
    onCellClick = null,
    legalMoves = [],
    lastMoveIdx = null,
    wrongIdx = null,
    size = null,
  } = options;

  const grid = document.createElement('div');
  grid.className = 'board-grid';
  if (size) grid.style.setProperty('--board-size', size);

  for (let idx = 0; idx < 64; idx++) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'board-cell';
    cell.dataset.idx = String(idx);

    const stoneVal = board[idx];
    if (stoneVal === BLACK || stoneVal === WHITE) {
      const stone = document.createElement('span');
      stone.className = 'stone ' + (stoneVal === BLACK ? 'stone-black' : 'stone-white');
      cell.appendChild(stone);
    } else if (legalMoves.includes(idx)) {
      const dot = document.createElement('span');
      dot.className = 'legal-dot';
      cell.appendChild(dot);
    }

    if (lastMoveIdx === idx) cell.classList.add('last-move');
    if (wrongIdx === idx) cell.classList.add('wrong-move');

    if (interactive && onCellClick) {
      cell.addEventListener('click', () => onCellClick(idx));
    } else {
      cell.disabled = true;
      cell.tabIndex = -1;
    }

    grid.appendChild(cell);
  }

  return grid;
}

function mountBoard(container, board, options) {
  container.innerHTML = '';
  container.appendChild(createBoardElement(board, options));
}
