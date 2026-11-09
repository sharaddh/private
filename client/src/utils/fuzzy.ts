function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(
        prev[j] + 1,
        next[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = next;
  }
  return prev[b.length];
}

function scoreSuggestion(rawQuery: string, rawSuggestion: string) {
  const query = normalize(rawQuery);
  const suggestion = normalize(rawSuggestion);
  if (!query) return 1;
  if (suggestion === query) return 1000;
  if (suggestion.startsWith(query)) return 900 - (suggestion.length - query.length);

  const words = suggestion.split(' ').filter(Boolean);
  const queryWords = query.split(' ').filter(Boolean);
  if (queryWords.length > 1 && queryWords.every((q) => words.some((w) => w.startsWith(q)))) {
    return 880 - Math.abs(suggestion.length - query.length);
  }
  if (words.some((w) => w.startsWith(query))) {
    return 850 - Math.abs(suggestion.length - query.length);
  }
  if (suggestion.includes(query)) {
    return 700 - suggestion.indexOf(query);
  }

  let cursor = 0;
  for (const ch of suggestion) {
    if (ch === query[cursor]) cursor++;
    if (cursor === query.length) break;
  }
  if (cursor === query.length) return 500 - Math.abs(suggestion.length - query.length);

  if (query.length >= 3) {
    const maxDistance = query.length <= 5 ? 1 : query.length <= 8 ? 2 : 3;
    const distance = levenshtein(query, suggestion);
    if (distance <= maxDistance) {
      return 400 - distance * 60 - Math.abs(suggestion.length - query.length);
    }
    let best = Number.POSITIVE_INFINITY;
    for (const word of words) best = Math.min(best, levenshtein(query, word));
    if (best <= maxDistance) return 380 - best * 60;
  }

  return -1;
}

export function fuzzyRankSuggestions(query: string, suggestions: string[]) {
  const ranked = suggestions
    .map((value, index) => ({ value, index, score: scoreSuggestion(query, value) }))
    .filter((item) => item.score >= 0);
  ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked.map((item) => item.value);
}
