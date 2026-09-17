// ---------- small helpers ----------

function turnText(player) {
  return player === BLACK ? '黒番' : '白番';
}

function formatMovesText(moves) {
  if (moves.length === 0) return '(手順なし)';
  return moves
    .map((m, i) => `${i + 1}. ${m.player === BLACK ? '黒' : '白'} ${idxToNotation(m.pos)}`)
    .join('  ');
}

function computeNextTurn(board, lastPlayer) {
  const opp = opponent(lastPlayer);
  if (hasAnyLegalMove(board, opp)) return opp;
  if (hasAnyLegalMove(board, lastPlayer)) return lastPlayer;
  return opp;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

function renderStars(container, value, onChange) {
  container.innerHTML = '';
  container.className = 'stars-row';
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'star-btn' + (i <= value ? ' filled' : '');
    btn.textContent = i <= value ? '★' : '☆';
    btn.addEventListener('click', () => onChange(value === i ? 0 : i));
    container.appendChild(btn);
  }
}

let toastTimer = null;
function showToast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
}

function createBottomNav(active) {
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  const dueCount = state.cards.filter((c) => c.srs.due <= Date.now()).length;
  nav.innerHTML = `
    <button data-nav="list" class="${active === 'list' ? 'active' : ''}">一覧</button>
    <button data-nav="review" class="${active === 'review' ? 'active' : ''}">復習${dueCount > 0 ? `<span class="badge">${dueCount}</span>` : ''}</button>
    <button data-nav="editor" class="${active === 'editor' ? 'active' : ''}">＋ 追加</button>
  `;
  nav.querySelector('[data-nav="list"]').addEventListener('click', goList);
  nav.querySelector('[data-nav="review"]').addEventListener('click', goReview);
  nav.querySelector('[data-nav="editor"]').addEventListener('click', goNewCardChoice);
  return nav;
}

function renderNewCardChoiceView(app) {
  const header = document.createElement('header');
  header.className = 'topbar';
  header.innerHTML = `
    <button class="icon-btn" id="btn-back">← 戻る</button>
    <h1>新規カード</h1>
    <span></span>
  `;
  app.appendChild(header);
  header.querySelector('#btn-back').addEventListener('click', goList);

  const body = document.createElement('div');
  body.className = 'scroll-body';
  body.innerHTML = `<p class="photo-help">作り方を選んでください</p>`;

  const options = [
    {
      title: '手動で盤面を作る',
      desc: '盤面をタップして石を置き、手順を記録します',
      action: goNewCard,
    },
    {
      title: '盤面を写真から読み取る',
      desc: '石が置かれた盤面の写真から自動で読み取ります',
      action: goNewCardViaBoardPhoto,
    },
    {
      title: '棋譜をテキストから読み込む',
      desc: '「F5, D6...」のような手順を貼り付けて読み込みます',
      action: goNewCardViaKifuText,
    },
  ];

  for (const opt of options) {
    const btn = document.createElement('button');
    btn.className = 'choice-card';
    btn.innerHTML = `<span class="choice-title">${opt.title}</span><span class="choice-desc">${opt.desc}</span>`;
    btn.addEventListener('click', opt.action);
    body.appendChild(btn);
  }

  app.appendChild(body);
}

// ---------- app state ----------

const state = {
  view: 'list',
  cards: loadCards(),
  editor: null,
  review: null,
  detailId: null,
  detailStep: null,
  listFilter: 'all',
  listSort: 'due',
  photoImport: null,
};

function persist() {
  saveCards(state.cards);
}

function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  if (state.view === 'list') renderListView(app);
  else if (state.view === 'new-card-choice') renderNewCardChoiceView(app);
  else if (state.view === 'editor') renderEditorView(app);
  else if (state.view === 'detail') renderDetailView(app);
  else if (state.view === 'review') renderReviewView(app);
  else if (state.view === 'photo-board') renderBoardPhotoImportView(app);
  else if (state.view === 'kifu-text-import') renderKifuTextImportView(app);
}

// ---------- navigation ----------

function goList() {
  state.view = 'list';
  render();
}

function createNewEditorState() {
  return {
    id: null,
    board: emptyBoard(),
    turn: BLACK,
    tool: 'black',
    mode: 'setup',
    frozenInitialBoard: null,
    frozenInitialTurn: null,
    moves: [],
    note: '',
    star: 0,
  };
}

function createEditorStateFromCard(card) {
  const initialBoard = boardFromString(card.initialBoard);
  const steps = replayMoves(initialBoard, card.moves);
  const finalBoard = steps[steps.length - 1].board;
  const turn = card.moves.length > 0
    ? computeNextTurn(finalBoard, card.moves[card.moves.length - 1].player)
    : card.initialTurn;
  return {
    id: card.id,
    board: finalBoard,
    turn,
    tool: 'black',
    mode: 'moves',
    frozenInitialBoard: initialBoard,
    frozenInitialTurn: card.initialTurn,
    moves: card.moves.slice(),
    note: card.note || '',
    star: card.star || 0,
  };
}

function goNewCardChoice() {
  state.view = 'new-card-choice';
  render();
}

function goNewCard() {
  state.editor = createNewEditorState();
  state.view = 'editor';
  render();
}

function goNewCardViaBoardPhoto() {
  state.editor = createNewEditorState();
  goPhotoBoardImport();
}

function goNewCardViaKifuText() {
  state.editor = createNewEditorState();
  goKifuTextImport();
}

function goEditCard(id) {
  const card = state.cards.find((c) => c.id === id);
  if (!card) return;
  state.editor = createEditorStateFromCard(card);
  state.view = 'editor';
  render();
}

function goDetail(id) {
  state.detailId = id;
  state.detailStep = null;
  state.view = 'detail';
  render();
}

function goReview() {
  state.review = null;
  state.view = 'review';
  render();
}

function goPhotoBoardImport() {
  state.photoImport = { type: 'board', step: 'pick', imageEl: null, corners: null, autoGuessed: false };
  state.view = 'photo-board';
  render();
}

function goKifuTextImport() {
  state.photoImport = { type: 'kifu-text', movesText: '', error: null };
  state.view = 'kifu-text-import';
  render();
}

function cancelPhotoImport() {
  state.photoImport = null;
  state.view = 'editor';
  render();
}

function buildReviewSession() {
  const due = state.cards.filter((c) => c.srs.due <= Date.now());
  due.sort((a, b) => a.srs.due - b.srs.due);
  return {
    queue: due.map((c) => c.id),
    index: 0,
    quizStep: 0,
    revealed: false,
    mistakeMade: false,
    wrongFeedback: null,
    step: 0,
  };
}

function resetReviewCardState(session) {
  session.quizStep = 0;
  session.revealed = false;
  session.mistakeMade = false;
  session.wrongFeedback = null;
  session.step = 0;
}

function handleQuizCellClick(session, card, idx) {
  const correctIdx = card.moves[session.quizStep].pos;
  if (idx === correctIdx) {
    showToast('正解!');
    session.quizStep += 1;
    if (session.quizStep >= card.moves.length) {
      session.revealed = true;
      session.step = card.moves.length;
    }
    render();
  } else {
    session.mistakeMade = true;
    session.wrongFeedback = { guessedIdx: idx, correctIdx };
    render();
  }
}

// ---------- editor actions ----------

function handleSetupModeCellClick(idx) {
  const ed = state.editor;
  ed.board[idx] = ed.tool === 'erase' ? EMPTY : ed.tool === 'black' ? BLACK : WHITE;
  render();
}

function handleMovesModeCellClick(idx) {
  const ed = state.editor;
  if (!isLegalMove(ed.board, idx, ed.turn)) {
    showToast('そこには置けません');
    return;
  }
  const player = ed.turn;
  ed.board = applyMove(ed.board, idx, player);
  ed.moves.push({ pos: idx, player });
  ed.turn = computeNextTurn(ed.board, player);
  render();
}

function undoLastMove() {
  const ed = state.editor;
  if (ed.moves.length === 0) return;
  ed.moves.pop();
  const steps = replayMoves(ed.frozenInitialBoard, ed.moves);
  ed.board = steps[steps.length - 1].board;
  ed.turn = ed.moves.length > 0
    ? computeNextTurn(ed.board, ed.moves[ed.moves.length - 1].player)
    : ed.frozenInitialTurn;
  render();
}

function startRecordingMoves() {
  const ed = state.editor;
  ed.frozenInitialBoard = ed.board.slice();
  ed.frozenInitialTurn = ed.turn;
  ed.moves = [];
  ed.mode = 'moves';
  render();
}

function backToSetup() {
  const ed = state.editor;
  if (ed.moves.length > 0 && !confirm('記録した手順が削除されます。よろしいですか？')) return;
  ed.board = ed.frozenInitialBoard.slice();
  ed.turn = ed.frozenInitialTurn;
  ed.moves = [];
  ed.mode = 'setup';
  render();
}

function resetToStandardStart() {
  state.editor.board = standardStartBoard();
  state.editor.turn = BLACK;
  render();
}

function clearEditorBoard() {
  state.editor.board = emptyBoard();
  render();
}

function saveEditorCard() {
  const ed = state.editor;
  if (ed.mode === 'setup') {
    showToast('先に「この配置から手順を記録する」を押してください');
    return;
  }
  if (ed.moves.length === 0) {
    showToast('少なくとも1手は記録してください');
    return;
  }
  const now = Date.now();
  const existing = ed.id ? state.cards.find((c) => c.id === ed.id) : null;
  const card = {
    id: ed.id || crypto.randomUUID(),
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
    initialBoard: boardToString(ed.frozenInitialBoard),
    initialTurn: ed.frozenInitialTurn,
    moves: ed.moves.map((m) => ({ pos: m.pos, player: m.player })),
    note: ed.note.trim(),
    star: ed.star,
    srs: existing ? existing.srs : createInitialSrs(),
  };
  if (existing) {
    state.cards[state.cards.findIndex((c) => c.id === ed.id)] = card;
  } else {
    state.cards.push(card);
  }
  persist();
  showToast('保存しました');
  goDetail(card.id);
}

// ---------- import / export ----------

function handleExport() {
  const json = exportCardsAsJSON(state.cards);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `othello-tesuji-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function handleImportPrompt() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = parseImportJSON(reader.result);
        if (!confirm(`${imported.length}件のカードを読み込みます。現在のカードは上書きされます。よろしいですか？`)) return;
        state.cards = imported;
        persist();
        showToast('読み込みました');
        render();
      } catch (e) {
        showToast('読み込みに失敗しました（形式が不正です）');
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

// ---------- list view ----------

function createCardListItem(card) {
  const item = document.createElement('div');
  item.className = 'card-item';

  const thumb = document.createElement('div');
  thumb.className = 'card-thumb';
  const initialBoard = boardFromString(card.initialBoard);
  const steps = replayMoves(initialBoard, card.moves);
  mountBoard(thumb, steps[steps.length - 1].board, { size: '64px' });
  item.appendChild(thumb);

  const info = document.createElement('div');
  info.className = 'card-info';
  const isDue = card.srs.due <= Date.now();
  info.innerHTML = `
    <div class="card-stars-mini">${'★'.repeat(card.star)}${'☆'.repeat(5 - card.star)}</div>
    <div class="card-due ${isDue ? 'due-now' : ''}">${isDue ? '復習期限' : dueLabel(card.srs.due)}</div>
    <div class="card-note">${escapeHtml(card.note) || '(メモなし)'}</div>
  `;
  item.appendChild(info);

  item.addEventListener('click', () => goDetail(card.id));
  return item;
}

function renderListView(app) {
  const header = document.createElement('header');
  header.className = 'topbar';
  header.innerHTML = `
    <h1>オセロ手筋帳</h1>
    <div class="topbar-actions">
      <button class="icon-btn" id="btn-export" title="書き出し">書出</button>
      <button class="icon-btn" id="btn-import" title="読み込み">読込</button>
    </div>
  `;
  app.appendChild(header);

  const body = document.createElement('div');
  body.className = 'scroll-body';

  const controlsRow = document.createElement('div');
  controlsRow.className = 'list-controls';
  controlsRow.innerHTML = `
    <select id="filter-select">
      <option value="all" ${state.listFilter === 'all' ? 'selected' : ''}>すべて</option>
      <option value="due" ${state.listFilter === 'due' ? 'selected' : ''}>復習期限のみ</option>
      <option value="favorite" ${state.listFilter === 'favorite' ? 'selected' : ''}>お気に入り(★4以上)</option>
    </select>
    <select id="sort-select">
      <option value="due" ${state.listSort === 'due' ? 'selected' : ''}>復習期限順</option>
      <option value="created" ${state.listSort === 'created' ? 'selected' : ''}>追加順(新しい)</option>
      <option value="star" ${state.listSort === 'star' ? 'selected' : ''}>重要度順</option>
    </select>
  `;
  body.appendChild(controlsRow);

  const listEl = document.createElement('div');
  listEl.className = 'card-list';

  let cards = state.cards.slice();
  if (state.listFilter === 'due') cards = cards.filter((c) => c.srs.due <= Date.now());
  if (state.listFilter === 'favorite') cards = cards.filter((c) => c.star >= 4);

  if (state.listSort === 'due') cards.sort((a, b) => a.srs.due - b.srs.due);
  else if (state.listSort === 'created') cards.sort((a, b) => b.createdAt - a.createdAt);
  else if (state.listSort === 'star') cards.sort((a, b) => b.star - a.star);

  if (cards.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = state.cards.length === 0
      ? 'まだカードがありません。右下の「追加」から最初の手筋を登録しましょう。'
      : '条件に一致するカードがありません。';
    listEl.appendChild(empty);
  } else {
    for (const card of cards) listEl.appendChild(createCardListItem(card));
  }
  body.appendChild(listEl);
  app.appendChild(body);
  app.appendChild(createBottomNav('list'));

  header.querySelector('#btn-export').addEventListener('click', handleExport);
  header.querySelector('#btn-import').addEventListener('click', handleImportPrompt);
  controlsRow.querySelector('#filter-select').addEventListener('change', (e) => {
    state.listFilter = e.target.value;
    render();
  });
  controlsRow.querySelector('#sort-select').addEventListener('change', (e) => {
    state.listSort = e.target.value;
    render();
  });
}

// ---------- editor view ----------

function renderEditorView(app) {
  const ed = state.editor;
  const isNew = !ed.id;

  const header = document.createElement('header');
  header.className = 'topbar';
  header.innerHTML = `
    <button class="icon-btn" id="btn-back">← 戻る</button>
    <h1>${isNew ? '新規カード' : 'カードを編集'}</h1>
    <button class="text-btn primary" id="btn-save">保存</button>
  `;
  app.appendChild(header);

  const body = document.createElement('div');
  body.className = 'scroll-body';

  const turnRow = document.createElement('div');
  turnRow.className = 'turn-indicator';
  turnRow.innerHTML = `<span class="stone-dot ${ed.turn === BLACK ? 'stone-black' : 'stone-white'}"></span> ${turnText(ed.turn)}${ed.mode === 'setup' ? '（先手）' : ''}`;
  body.appendChild(turnRow);

  const boardContainer = document.createElement('div');
  boardContainer.className = 'board-container';
  const legalMoves = ed.mode === 'moves' ? getLegalMoves(ed.board, ed.turn) : [];
  const lastMoveIdx = ed.mode === 'moves' && ed.moves.length > 0 ? ed.moves[ed.moves.length - 1].pos : null;
  mountBoard(boardContainer, ed.board, {
    interactive: true,
    onCellClick: ed.mode === 'setup' ? handleSetupModeCellClick : handleMovesModeCellClick,
    legalMoves,
    lastMoveIdx,
  });
  body.appendChild(boardContainer);

  const controls = document.createElement('div');
  controls.className = 'editor-controls';

  if (ed.mode === 'setup') {
    controls.innerHTML = `
      <div class="control-group">
        <label>置く石</label>
        <div class="segmented" id="tool-segmented">
          <button data-tool="black" class="${ed.tool === 'black' ? 'active' : ''}">●黒</button>
          <button data-tool="white" class="${ed.tool === 'white' ? 'active' : ''}">○白</button>
          <button data-tool="erase" class="${ed.tool === 'erase' ? 'active' : ''}">消す</button>
        </div>
      </div>
      <div class="control-group">
        <label>先手</label>
        <div class="segmented" id="turn-segmented">
          <button data-turn="B" class="${ed.turn === BLACK ? 'active' : ''}">黒番から</button>
          <button data-turn="W" class="${ed.turn === WHITE ? 'active' : ''}">白番から</button>
        </div>
      </div>
      <div class="control-group button-row">
        <button class="text-btn" id="btn-standard">標準配置</button>
        <button class="text-btn" id="btn-clear">全消去</button>
      </div>
      <div class="control-group button-row">
        <button class="text-btn" id="btn-photo-board">盤面を写真から読取</button>
        <button class="text-btn" id="btn-photo-kifu">棋譜をテキストから読込</button>
      </div>
      <button class="primary-btn" id="btn-start-moves">この配置から手順を記録する</button>
    `;
  } else {
    controls.innerHTML = `
      <div class="control-group button-row">
        <button class="text-btn" id="btn-undo" ${ed.moves.length === 0 ? 'disabled' : ''}>1手戻す</button>
        <button class="text-btn" id="btn-back-setup">盤面編集に戻す</button>
      </div>
      <div class="moves-text">${formatMovesText(ed.moves)}</div>
    `;
  }
  body.appendChild(controls);

  const metaSection = document.createElement('div');
  metaSection.className = 'editor-meta';
  metaSection.innerHTML = `
    <label>重要度</label>
    <div id="star-row"></div>
    <label>メモ（解説やポイントなど）</label>
    <textarea id="note-input" rows="4" placeholder="この手筋のポイントをメモ...">${escapeHtml(ed.note)}</textarea>
  `;
  body.appendChild(metaSection);

  app.appendChild(body);

  header.querySelector('#btn-back').addEventListener('click', goList);
  header.querySelector('#btn-save').addEventListener('click', saveEditorCard);

  if (ed.mode === 'setup') {
    controls.querySelectorAll('#tool-segmented button').forEach((btn) => {
      btn.addEventListener('click', () => {
        ed.tool = btn.dataset.tool;
        render();
      });
    });
    controls.querySelectorAll('#turn-segmented button').forEach((btn) => {
      btn.addEventListener('click', () => {
        ed.turn = btn.dataset.turn;
        render();
      });
    });
    controls.querySelector('#btn-standard').addEventListener('click', resetToStandardStart);
    controls.querySelector('#btn-clear').addEventListener('click', clearEditorBoard);
    controls.querySelector('#btn-photo-board').addEventListener('click', goPhotoBoardImport);
    controls.querySelector('#btn-photo-kifu').addEventListener('click', goKifuTextImport);
    controls.querySelector('#btn-start-moves').addEventListener('click', startRecordingMoves);
  } else {
    controls.querySelector('#btn-undo').addEventListener('click', undoLastMove);
    controls.querySelector('#btn-back-setup').addEventListener('click', backToSetup);
  }

  renderStars(metaSection.querySelector('#star-row'), ed.star, (val) => {
    ed.star = val;
    render();
  });
  metaSection.querySelector('#note-input').addEventListener('input', (e) => {
    ed.note = e.target.value;
  });
}

// ---------- detail view ----------

function renderDetailView(app) {
  const card = state.cards.find((c) => c.id === state.detailId);
  if (!card) {
    goList();
    return;
  }

  const initialBoard = boardFromString(card.initialBoard);
  const steps = replayMoves(initialBoard, card.moves);
  if (state.detailStep === null || state.detailStep === undefined) state.detailStep = steps.length - 1;
  const stepIdx = Math.min(state.detailStep, steps.length - 1);

  const header = document.createElement('header');
  header.className = 'topbar';
  header.innerHTML = `
    <button class="icon-btn" id="btn-back">← 戻る</button>
    <h1>手筋の詳細</h1>
    <button class="text-btn primary" id="btn-edit">編集</button>
  `;
  app.appendChild(header);

  const body = document.createElement('div');
  body.className = 'scroll-body';

  const turnRow = document.createElement('div');
  turnRow.className = 'turn-indicator';
  turnRow.innerHTML = `<span class="stone-dot ${card.initialTurn === BLACK ? 'stone-black' : 'stone-white'}"></span> 初期手番: ${turnText(card.initialTurn)}`;
  body.appendChild(turnRow);

  const boardContainer = document.createElement('div');
  boardContainer.className = 'board-container';
  mountBoard(boardContainer, steps[stepIdx].board, { lastMoveIdx: steps[stepIdx].moveIdx });
  body.appendChild(boardContainer);

  const playback = document.createElement('div');
  playback.className = 'playback-controls';
  playback.innerHTML = `
    <button id="step-first" ${stepIdx === 0 ? 'disabled' : ''}>|◀</button>
    <button id="step-prev" ${stepIdx === 0 ? 'disabled' : ''}>◀</button>
    <span class="step-label">${stepIdx} / ${steps.length - 1}</span>
    <button id="step-next" ${stepIdx === steps.length - 1 ? 'disabled' : ''}>▶</button>
    <button id="step-last" ${stepIdx === steps.length - 1 ? 'disabled' : ''}>▶|</button>
  `;
  body.appendChild(playback);

  const movesText = document.createElement('div');
  movesText.className = 'moves-text';
  movesText.textContent = formatMovesText(card.moves);
  body.appendChild(movesText);

  const starsSection = document.createElement('div');
  starsSection.className = 'detail-section';
  starsSection.innerHTML = `<label>重要度</label>`;
  const starRow = document.createElement('div');
  starsSection.appendChild(starRow);
  body.appendChild(starsSection);

  const noteSection = document.createElement('div');
  noteSection.className = 'detail-section';
  noteSection.innerHTML = `<label>メモ</label><p class="note-text">${escapeHtml(card.note) || '(メモなし)'}</p>`;
  body.appendChild(noteSection);

  const srsSection = document.createElement('div');
  srsSection.className = 'detail-section srs-info';
  const isDue = card.srs.due <= Date.now();
  srsSection.textContent = `次回復習: ${isDue ? '期限が来ています' : dueLabel(card.srs.due)} ／ 復習回数: ${card.srs.reps}`;
  body.appendChild(srsSection);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'danger-btn';
  deleteBtn.textContent = 'このカードを削除';
  body.appendChild(deleteBtn);

  app.appendChild(body);

  header.querySelector('#btn-back').addEventListener('click', goList);
  header.querySelector('#btn-edit').addEventListener('click', () => goEditCard(card.id));

  playback.querySelector('#step-first').addEventListener('click', () => {
    state.detailStep = 0;
    render();
  });
  playback.querySelector('#step-prev').addEventListener('click', () => {
    state.detailStep = Math.max(0, stepIdx - 1);
    render();
  });
  playback.querySelector('#step-next').addEventListener('click', () => {
    state.detailStep = Math.min(steps.length - 1, stepIdx + 1);
    render();
  });
  playback.querySelector('#step-last').addEventListener('click', () => {
    state.detailStep = steps.length - 1;
    render();
  });

  renderStars(starRow, card.star, (val) => {
    card.star = val;
    persist();
    render();
  });

  deleteBtn.addEventListener('click', () => {
    if (!confirm('このカードを削除しますか？この操作は取り消せません。')) return;
    state.cards = state.cards.filter((c) => c.id !== card.id);
    persist();
    goList();
  });
}

// ---------- review view ----------

function renderReviewLanding(app) {
  const header = document.createElement('header');
  header.className = 'topbar';
  header.innerHTML = `<h1>復習</h1>`;
  app.appendChild(header);

  const dueCount = state.cards.filter((c) => c.srs.due <= Date.now()).length;

  const body = document.createElement('div');
  body.className = 'scroll-body review-landing';
  body.innerHTML = `
    <p class="landing-message">${dueCount > 0 ? `今日復習できるカードが ${dueCount} 枚あります` : '今日復習するカードはありません'}</p>
    ${dueCount === 0 ? '<p class="landing-sub">新しいカードを追加するか、また明日確認しましょう。</p>' : ''}
  `;
  if (dueCount > 0) {
    const startBtn = document.createElement('button');
    startBtn.className = 'primary-btn';
    startBtn.textContent = '復習を始める';
    startBtn.addEventListener('click', () => {
      state.review = buildReviewSession();
      render();
    });
    body.appendChild(startBtn);
  }
  app.appendChild(body);
  app.appendChild(createBottomNav('review'));
}

function renderReviewComplete(app) {
  const header = document.createElement('header');
  header.className = 'topbar';
  header.innerHTML = `<h1>復習</h1>`;
  app.appendChild(header);

  const body = document.createElement('div');
  body.className = 'scroll-body review-landing';
  body.innerHTML = `<p class="landing-message">本日の復習が完了しました</p>`;
  const btn = document.createElement('button');
  btn.className = 'primary-btn';
  btn.textContent = '一覧へ戻る';
  btn.addEventListener('click', () => {
    state.review = null;
    goList();
  });
  body.appendChild(btn);
  app.appendChild(body);
  app.appendChild(createBottomNav('review'));
}

function renderReviewView(app) {
  if (!state.review) {
    renderReviewLanding(app);
    return;
  }
  const session = state.review;
  if (session.index >= session.queue.length) {
    renderReviewComplete(app);
    return;
  }

  const card = state.cards.find((c) => c.id === session.queue[session.index]);
  if (!card) {
    session.index++;
    render();
    return;
  }

  const initialBoard = boardFromString(card.initialBoard);
  const steps = replayMoves(initialBoard, card.moves);

  const header = document.createElement('header');
  header.className = 'topbar';
  header.innerHTML = `
    <button class="icon-btn" id="btn-exit-review">× 終了</button>
    <span class="progress-label">${session.index + 1} / ${session.queue.length}</span>
  `;
  app.appendChild(header);

  const body = document.createElement('div');
  body.className = 'scroll-body';

  if (session.wrongFeedback) {
    renderReviewWrongFeedback(body, session, card, steps);
  } else if (!session.revealed) {
    renderReviewQuizStep(body, session, card, steps);
  } else {
    renderReviewReveal(body, session, card, steps);
  }

  app.appendChild(body);
  header.querySelector('#btn-exit-review').addEventListener('click', () => {
    state.review = null;
    goList();
  });
}

function renderReviewQuizStep(body, session, card, steps) {
  const quizStep = session.quizStep;
  const board = steps[quizStep].board;
  const player = card.moves[quizStep].player;
  const legalMoves = getLegalMoves(board, player);

  const turnRow = document.createElement('div');
  turnRow.className = 'turn-indicator';
  turnRow.innerHTML = `<span class="stone-dot ${player === BLACK ? 'stone-black' : 'stone-white'}"></span> ${turnText(player)}で最善手を打ってみましょう（${quizStep + 1}手目 / ${card.moves.length}手中）`;
  body.appendChild(turnRow);

  const boardContainer = document.createElement('div');
  boardContainer.className = 'board-container';
  mountBoard(boardContainer, board, {
    interactive: true,
    legalMoves,
    onCellClick: (idx) => handleQuizCellClick(session, card, idx),
  });
  body.appendChild(boardContainer);

  const giveUpBtn = document.createElement('button');
  giveUpBtn.className = 'text-btn';
  giveUpBtn.textContent = 'わからない（答えを見る）';
  giveUpBtn.addEventListener('click', () => {
    session.mistakeMade = true;
    session.wrongFeedback = { guessedIdx: null, correctIdx: card.moves[quizStep].pos };
    render();
  });
  body.appendChild(giveUpBtn);
}

function renderReviewWrongFeedback(body, session, card, steps) {
  const quizStep = session.quizStep;
  const board = steps[quizStep].board;
  const { guessedIdx, correctIdx } = session.wrongFeedback;

  const msg = document.createElement('p');
  msg.className = 'import-error';
  msg.textContent = guessedIdx === null
    ? `正解は ${idxToNotation(correctIdx)} でした。`
    : `不正解です（${idxToNotation(guessedIdx)}をタップ）。正解は ${idxToNotation(correctIdx)} でした。`;
  body.appendChild(msg);

  const boardContainer = document.createElement('div');
  boardContainer.className = 'board-container';
  mountBoard(boardContainer, board, { lastMoveIdx: correctIdx, wrongIdx: guessedIdx });
  body.appendChild(boardContainer);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'primary-btn';
  nextBtn.textContent = '続きを見る';
  nextBtn.addEventListener('click', () => {
    session.wrongFeedback = null;
    session.revealed = true;
    session.step = steps.length - 1;
    render();
  });
  body.appendChild(nextBtn);
}

function renderReviewReveal(body, session, card, steps) {
  const stepIdx = Math.min(session.step, steps.length - 1);

  const resultMsg = document.createElement('p');
  resultMsg.className = 'photo-help';
  resultMsg.textContent = session.mistakeMade ? '正解の手順を確認しましょう。' : '全問正解です!';
  body.appendChild(resultMsg);

  const turnRow = document.createElement('div');
  turnRow.className = 'turn-indicator';
  turnRow.innerHTML = `<span class="stone-dot ${card.initialTurn === BLACK ? 'stone-black' : 'stone-white'}"></span> 初期手番: ${turnText(card.initialTurn)}`;
  body.appendChild(turnRow);

  const boardContainer = document.createElement('div');
  boardContainer.className = 'board-container';
  mountBoard(boardContainer, steps[stepIdx].board, { lastMoveIdx: steps[stepIdx].moveIdx });
  body.appendChild(boardContainer);

  const playback = document.createElement('div');
  playback.className = 'playback-controls';
  playback.innerHTML = `
    <button id="step-first" ${stepIdx === 0 ? 'disabled' : ''}>|◀</button>
    <button id="step-prev" ${stepIdx === 0 ? 'disabled' : ''}>◀</button>
    <span class="step-label">${stepIdx} / ${steps.length - 1}</span>
    <button id="step-next" ${stepIdx === steps.length - 1 ? 'disabled' : ''}>▶</button>
    <button id="step-last" ${stepIdx === steps.length - 1 ? 'disabled' : ''}>▶|</button>
  `;
  body.appendChild(playback);

  const movesText = document.createElement('div');
  movesText.className = 'moves-text';
  movesText.textContent = formatMovesText(card.moves);
  body.appendChild(movesText);

  if (card.note) {
    const noteEl = document.createElement('p');
    noteEl.className = 'note-text';
    noteEl.textContent = card.note;
    body.appendChild(noteEl);
  }

  const ratingRow = document.createElement('div');
  ratingRow.className = 'rating-buttons';
  ratingRow.innerHTML = `
    <button data-q="0" class="rating-again">もう一度</button>
    <button data-q="3" class="rating-hard">難しい</button>
    <button data-q="4" class="rating-good">普通</button>
    <button data-q="5" class="rating-easy">簡単</button>
  `;
  body.appendChild(ratingRow);

  playback.querySelector('#step-first').addEventListener('click', () => {
    session.step = 0;
    render();
  });
  playback.querySelector('#step-prev').addEventListener('click', () => {
    session.step = Math.max(0, stepIdx - 1);
    render();
  });
  playback.querySelector('#step-next').addEventListener('click', () => {
    session.step = Math.min(steps.length - 1, stepIdx + 1);
    render();
  });
  playback.querySelector('#step-last').addEventListener('click', () => {
    session.step = steps.length - 1;
    render();
  });

  ratingRow.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const quality = Number(btn.dataset.q);
      card.srs = scheduleReview(card.srs, quality);
      persist();
      session.index++;
      resetReviewCardState(session);
      render();
    });
  });
}

// ---------- init ----------

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => console.error('SW registration failed', err));
    });
  }
}

render();
registerServiceWorker();
