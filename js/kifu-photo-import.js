let tesseractLoadPromise = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (tesseractLoadPromise) return tesseractLoadPromise;
  tesseractLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    script.onload = () => resolve(window.Tesseract);
    script.onerror = () => reject(new Error('文字認識ライブラリの読み込みに失敗しました。通信環境を確認してください。'));
    document.head.appendChild(script);
  });
  return tesseractLoadPromise;
}

async function recognizeKifuImage(imageEl, onProgress) {
  const Tesseract = await loadTesseract();
  const worker = await Tesseract.createWorker('eng', 1, {
    logger: (msg) => {
      if (onProgress && msg.status === 'recognizing text') onProgress(msg.progress);
    },
  });
  try {
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHabcdefgh12345678 ,.\n-',
    });
    const { data } = await worker.recognize(imageEl);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

function movesTextToTokens(text) {
  const matches = text.match(/[A-Ha-h][1-8]/g) || [];
  return matches.map((m) => m[0].toUpperCase() + m[1]);
}

// Replays tokens from the standard start position (black first) through the real
// Othello rules, so an OCR misread shows up immediately as an illegal move.
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

function renderKifuPhotoImportView(app) {
  const pi = state.photoImport;

  const header = document.createElement('header');
  header.className = 'topbar';
  header.innerHTML = `
    <button class="icon-btn" id="btn-cancel-photo">× キャンセル</button>
    <h1>棋譜を写真から読取</h1>
    <span></span>
  `;
  app.appendChild(header);
  header.querySelector('#btn-cancel-photo').addEventListener('click', cancelPhotoImport);

  const body = document.createElement('div');
  body.className = 'scroll-body';

  if (pi.step === 'pick') {
    body.innerHTML = `<p class="photo-help">「F5, D6, C3...」のように書かれた手順リストの写真を選んでください。標準の初期配置・黒番スタートとして読み込みます。</p>`;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.className = 'photo-file-input';
    body.appendChild(input);
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      loadImageFile(file, (img) => {
        pi.imageEl = img;
        pi.step = 'processing';
        pi.progress = 0;
        render();
        runKifuOcr(pi);
      });
    });
  } else if (pi.step === 'processing') {
    body.innerHTML = `
      <div class="ocr-progress">
        <div class="spinner"></div>
        <p>文字を読み取っています... ${Math.round((pi.progress || 0) * 100)}%</p>
      </div>
    `;
  } else if (pi.step === 'review') {
    body.innerHTML = `
      <p class="photo-help">読み取り結果です。誤りがあれば直接書き直してください（例: F5, D6, C3 ...）。</p>
      <textarea id="moves-text-input" rows="4">${escapeHtml(pi.movesText)}</textarea>
      ${pi.error ? `<p class="ocr-error">${escapeHtml(pi.error)}</p>` : ''}
    `;
    const validateBtn = document.createElement('button');
    validateBtn.className = 'primary-btn';
    validateBtn.textContent = '検証して手順を作成';
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
        pi.error = `${result.index + 1}手目「${result.notation}」がその局面では着手できません。誤読の可能性があるので修正してください。`;
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
  }

  app.appendChild(body);
}

function runKifuOcr(pi) {
  let lastShown = -1;
  recognizeKifuImage(pi.imageEl, (progress) => {
    if (state.photoImport !== pi) return;
    const pct = Math.round(progress * 100);
    if (pct === lastShown) return;
    lastShown = pct;
    pi.progress = progress;
    render();
  }).then((text) => {
    if (state.photoImport !== pi) return;
    const tokens = movesTextToTokens(text);
    pi.movesText = tokens.join(', ');
    pi.error = tokens.length === 0
      ? '手が見つかりませんでした。手順がはっきり写った写真で試すか、下の欄に直接入力してください。'
      : null;
    pi.step = 'review';
    render();
  }).catch((err) => {
    if (state.photoImport !== pi) return;
    pi.movesText = '';
    pi.error = err.message || '読み取りに失敗しました。';
    pi.step = 'review';
    render();
  });
}
