// Simplified SM-2 spaced-repetition scheduler.
// quality: 0 = もう一度 (again), 3 = 難しい (hard), 4 = 普通 (good), 5 = 簡単 (easy)
function createInitialSrs() {
  return { ef: 2.5, interval: 0, reps: 0, due: Date.now() };
}

function scheduleReview(srs, quality) {
  let { ef, interval, reps } = srs;

  if (quality < 3) {
    reps = 0;
    interval = 1;
  } else {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 6;
    else interval = Math.round(interval * ef);
    reps += 1;
  }

  ef = Math.max(1.3, ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  const due = Date.now() + interval * 24 * 60 * 60 * 1000;

  return { ef, interval, reps, due };
}

function dueLabel(due) {
  const diffMs = due - Date.now();
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (diffMs <= 0) return '復習期限';
  if (days <= 1) return '明日復習';
  return `${days}日後`;
}
