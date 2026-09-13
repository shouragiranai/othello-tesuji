const EMPTY = '.';
const BLACK = 'B';
const WHITE = 'W';

const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

function opponent(player) {
  return player === BLACK ? WHITE : BLACK;
}

function emptyBoard() {
  return new Array(64).fill(EMPTY);
}

function standardStartBoard() {
  const b = emptyBoard();
  b[3 * 8 + 3] = WHITE; // D4
  b[3 * 8 + 4] = BLACK; // E4
  b[4 * 8 + 3] = BLACK; // D5
  b[4 * 8 + 4] = WHITE; // E5
  return b;
}

function getFlips(board, idx, player) {
  if (board[idx] !== EMPTY) return [];
  const opp = opponent(player);
  const row = (idx / 8) | 0;
  const col = idx % 8;
  const flips = [];
  for (const [dr, dc] of DIRECTIONS) {
    let r = row + dr;
    let c = col + dc;
    const line = [];
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === opp) {
      line.push(r * 8 + c);
      r += dr;
      c += dc;
    }
    if (line.length > 0 && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === player) {
      flips.push(...line);
    }
  }
  return flips;
}

function isLegalMove(board, idx, player) {
  return board[idx] === EMPTY && getFlips(board, idx, player).length > 0;
}

function getLegalMoves(board, player) {
  const moves = [];
  for (let i = 0; i < 64; i++) {
    if (isLegalMove(board, i, player)) moves.push(i);
  }
  return moves;
}

function applyMove(board, idx, player) {
  const flips = getFlips(board, idx, player);
  const next = board.slice();
  next[idx] = player;
  for (const f of flips) next[f] = player;
  return next;
}

function hasAnyLegalMove(board, player) {
  for (let i = 0; i < 64; i++) {
    if (isLegalMove(board, i, player)) return true;
  }
  return false;
}

function idxToNotation(idx) {
  const row = (idx / 8) | 0;
  const col = idx % 8;
  return String.fromCharCode(65 + col) + (row + 1);
}

function notationToIdx(notation) {
  const col = notation.toUpperCase().charCodeAt(0) - 65;
  const row = Number(notation.slice(1)) - 1;
  return row * 8 + col;
}

function boardToString(board) {
  return board.join('');
}

function boardFromString(str) {
  return str.split('');
}

// steps[0] is the initial position; steps[i] is the board after the i-th recorded move.
function replayMoves(initialBoard, moves) {
  let board = initialBoard.slice();
  const steps = [{ board: board.slice(), moveIdx: null, player: null }];
  for (const mv of moves) {
    board = applyMove(board, mv.pos, mv.player);
    steps.push({ board: board.slice(), moveIdx: mv.pos, player: mv.player });
  }
  return steps;
}
