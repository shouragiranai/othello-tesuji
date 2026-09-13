function movesTextToTokens(text) {
  const matches = text.match(/[A-Ha-h][1-8]/g) || [];
  return matches.map((m) => m[0].toUpperCase() + m[1]);
}

// Replays tokens from the standard start position (black first) through the real
// Othello rules, so a typo shows up immediately as an illegal move.
function validateMoveTokens(tokens) {
  let board = standardStartBoard();
  let turn = BLACK;
  const moves = [];
  for (let i = 0; i < tokens.length; i++) {
    const notation = tokens[i];
    const idx = notationToIdx(notation);
    if (!isLegalMove(board, idx, turn)) {
      return { ok: false, index: i, notation };
    }
    board = applyMove(board, idx, turn);
    moves.push({ pos: idx, player: turn });
    turn = computeNextTurn(board, turn);
  }
  return { ok: true, moves, board };
}

function renderKifuTextImportView(app) {
  const pi = state.photoImport;

  const header = document.createElement('header');
  header.className = 'topbar';
  header.innerHTML = `
    <button class="icon-btn" id="btn-cancel-photo">× キャンセル</button>
    <h1>棋譜をテキストから読込</h1>
    <span></span>
  `;
  app.appendChild(header);
  header.querySelector('#btn-cancel-photo').addEventListener('click', cancelPhotoImport);

  const body = document.createElement('div');
  body.className = 'scroll-body';
  body.innerHTML = `
    <p class="photo-help">「F5, D6, C3...」のように手順を貼り付けてください。標準の初期配置・黒番スタートとして読み込みます。</p>
    <textarea id="moves-text-input" rows="5" placeholder="例: F5, F6, E6, F4, ...">${escapeHtml(pi.movesText)}</textarea>
    ${pi.error ? `<p class="import-error">${escapeHtml(pi.error)}</p>` : ''}
  `;

  const validateBtn = document.createElement('button');
  validateBtn.className = 'primary-btn';
  validateBtn.textContent = '読み込む';
  body.appendChild(validateBtn);

  body.querySelector('#moves-text-input').addEventListener('input', (e) => {
    pi.movesText = e.target.value;
  });

  validateBtn.addEventListener('click', () => {
    const tokens = movesTextToTokens(pi.movesText);
    if (tokens.length === 0) {
      pi.error = '有効な手（例: F5）が見つかりませんでした。';
      render();
      return;
    }
    const result = validateMoveTokens(tokens);
    if (!result.ok) {
      pi.error = `${result.index + 1}手目「${result.notation}」がその局面では着手できません。入力を見直してください。`;
      render();
      return;
    }
    state.editor.frozenInitialBoard = standardStartBoard();
    state.editor.frozenInitialTurn = BLACK;
    state.editor.moves = result.moves;
    state.editor.board = result.board;
    state.editor.turn = computeNextTurn(result.board, result.moves[result.moves.length - 1].player);
    state.editor.mode = 'moves';
    state.photoImport = null;
    state.view = 'editor';
    showToast(`${result.moves.length}手を読み込みました`);
    render();
  });

  app.appendChild(body);
}
