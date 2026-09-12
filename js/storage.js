const STORAGE_KEY = 'othelloTesujiCards.v1';

function loadCards() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Failed to load cards', e);
    return [];
  }
}

function saveCards(cards) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

function exportCardsAsJSON(cards) {
  return JSON.stringify({ version: 1, exportedAt: Date.now(), cards }, null, 2);
}

function parseImportJSON(text) {
  const data = JSON.parse(text);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.cards)) return data.cards;
  throw new Error('invalid format');
}
