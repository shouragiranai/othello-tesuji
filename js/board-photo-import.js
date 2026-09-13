const BOARD_UNIT_CORNERS = [
  { x: 0, y: 0 }, // tl
  { x: 1, y: 0 }, // tr
  { x: 1, y: 1 }, // br
  { x: 0, y: 1 }, // bl
];

function defaultNormalizedCorners() {
  return {
    tl: { x: 0.12, y: 0.12 },
    tr: { x: 0.88, y: 0.12 },
    br: { x: 0.88, y: 0.88 },
    bl: { x: 0.12, y: 0.88 },
  };
}

// Samples the 64 cell centers of the quadrilateral (normCorners, normalized 0-1
// against the image) via a homography, then classifies each by luminance relative
// to the darkest/lightest cells detected (board felt sits in between the two stone
// colors, so a simple tercile split is enough without any board-color calibration).
function sampleBoardFromImage(imageEl, normCorners) {
  const w = imageEl.naturalWidth;
  const h = imageEl.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageEl, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);

  const cornersPx = {
    tl: { x: normCorners.tl.x * w, y: normCorners.tl.y * h },
    tr: { x: normCorners.tr.x * w, y: normCorners.tr.y * h },
    br: { x: normCorners.br.x * w, y: normCorners.br.y * h },
    bl: { x: normCorners.bl.x * w, y: normCorners.bl.y * h },
  };
  const mapper = computeHomography(BOARD_UNIT_CORNERS, [
    cornersPx.tl, cornersPx.tr, cornersPx.br, cornersPx.bl,
  ]);

  const lumAt = (x, y) => {
    x = Math.max(0, Math.min(w - 1, Math.round(x)));
    y = Math.max(0, Math.min(h - 1, Math.round(y)));
    const i = (y * w + x) * 4;
    const d = imageData.data;
    return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  };

  const cellSpan = Math.hypot(cornersPx.tr.x - cornersPx.tl.x, cornersPx.tr.y - cornersPx.tl.y) / 8;
  const r = Math.max(1, Math.round(cellSpan * 0.18));
  const offsets = [-r, 0, r];

  const luminances = new Array(64);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const u = (col + 0.5) / 8;
      const v = (row + 0.5) / 8;
      const { x, y } = mapper(u, v);
      let total = 0;
      let count = 0;
      for (const dy of offsets) {
        for (const dx of offsets) {
          total += lumAt(x + dx, y + dy);
          count++;
        }
      }
      luminances[row * 8 + col] = total / count;
    }
  }

  const sorted = luminances.slice().sort((a, b2) => a - b2);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const range = max - min;
  const board = emptyBoard();
  if (range > 15) {
    const lowT = min + range / 3;
    const highT = min + (range * 2) / 3;
    for (let i = 0; i < 64; i++) {
      if (luminances[i] <= lowT) board[i] = BLACK;
      else if (luminances[i] >= highT) board[i] = WHITE;
    }
  }
  return board;
}

function renderBoardPhotoImportView(app) {
  const pi = state.photoImport;

  const header = document.createElement('header');
  header.className = 'topbar';
  header.innerHTML = `
    <button class="icon-btn" id="btn-cancel-photo">× キャンセル</button>
    <h1>盤面を写真から読取</h1>
    <span></span>
  `;
  app.appendChild(header);
  header.querySelector('#btn-cancel-photo').addEventListener('click', cancelPhotoImport);

  const body = document.createElement('div');
  body.className = 'scroll-body';

  if (pi.step === 'pick') {
    body.innerHTML = `<p class="photo-help">盤面全体が写った写真を選んでください。斜めの写真でも次の画面で4隅を指定すれば補正できます。</p>`;
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
        pi.corners = defaultNormalizedCorners();
        pi.step = 'adjust';
        render();
      });
    });
  } else if (pi.step === 'adjust') {
    body.innerHTML = `<p class="photo-help">4つの丸を盤面の外枠（8×8マスの角）に合わせてください。</p>`;
    const stage = document.createElement('div');
    stage.className = 'photo-stage';
    const canvas = document.createElement('canvas');
    stage.appendChild(canvas);
    body.appendChild(stage);

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'primary-btn';
    confirmBtn.textContent = 'この位置で読み取る';
    body.appendChild(confirmBtn);

    setupPhotoAdjustStage(stage, canvas, pi, () => {
      const detected = sampleBoardFromImage(pi.imageEl, pi.corners);
      state.editor.board = detected;
      state.photoImport = null;
      state.view = 'editor';
      showToast('盤面を読み取りました。間違っている石はタップして修正してください');
      render();
    }, confirmBtn);
  }

  app.appendChild(body);
}

function loadImageFile(file, onLoaded) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => onLoaded(img);
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function setupPhotoAdjustStage(stage, canvas, pi, onConfirm, confirmBtn) {
  const img = pi.imageEl;
  const maxW = Math.min(460, window.innerWidth - 32);
  const scale = maxW / img.naturalWidth;
  const dispW = Math.round(img.naturalWidth * scale);
  const dispH = Math.round(img.naturalHeight * scale);
  canvas.width = dispW;
  canvas.height = dispH;
  stage.style.width = dispW + 'px';
  stage.style.height = dispH + 'px';
  const ctx = canvas.getContext('2d');

  const handles = {};
  for (const key of ['tl', 'tr', 'br', 'bl']) {
    const handle = document.createElement('div');
    handle.className = 'corner-handle';
    handle.dataset.key = key;
    stage.appendChild(handle);
    handles[key] = handle;
  }

  function positionHandle(key) {
    const norm = pi.corners[key];
    handles[key].style.left = norm.x * dispW + 'px';
    handles[key].style.top = norm.y * dispH + 'px';
  }

  function redraw() {
    ctx.clearRect(0, 0, dispW, dispH);
    ctx.drawImage(img, 0, 0, dispW, dispH);

    const c = pi.corners;
    const mapper = computeHomography(BOARD_UNIT_CORNERS, [
      { x: c.tl.x * dispW, y: c.tl.y * dispH },
      { x: c.tr.x * dispW, y: c.tr.y * dispH },
      { x: c.br.x * dispW, y: c.br.y * dispH },
      { x: c.bl.x * dispW, y: c.bl.y * dispH },
    ]);
    ctx.strokeStyle = 'rgba(255, 204, 0, 0.85)';
    ctx.lineWidth = 1.5;
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      let p1 = mapper(t, 0);
      let p2 = mapper(t, 1);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      p1 = mapper(0, t);
      p2 = mapper(1, t);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    for (const key of ['tl', 'tr', 'br', 'bl']) positionHandle(key);
  }

  for (const key of ['tl', 'tr', 'br', 'bl']) {
    const handle = handles[key];
    let dragging = false;
    handle.addEventListener('pointerdown', (e) => {
      dragging = true;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const rect = stage.getBoundingClientRect();
      let x = (e.clientX - rect.left) / dispW;
      let y = (e.clientY - rect.top) / dispH;
      x = Math.max(0, Math.min(1, x));
      y = Math.max(0, Math.min(1, y));
      pi.corners[key] = { x, y };
      redraw();
    });
    handle.addEventListener('pointerup', () => {
      dragging = false;
    });
    handle.addEventListener('pointercancel', () => {
      dragging = false;
    });
  }

  confirmBtn.addEventListener('click', onConfirm);

  redraw();
}
