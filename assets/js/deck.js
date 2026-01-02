/* Deck officiel Flip7 :
   - Numéros: 12x12, 11x11, ... 2x2, 1x1, 0x1 (0 vaut 0 point)
   - Bonus: x2, +2, +4, +6, +8, +10 (1 chacun)
   - Spéciales: Stop x3, TroisALaSuite x3, SecondeChance x3
*/

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function buildOfficialDeck() {
  const deck = [];

  // Numbers
  deck.push({ type: 'number', value: 0, label: '0' }); // 1 exemplaire
  deck.push({ type: 'number', value: 1, label: '1' }); // 1 exemplaire
  for (let v = 2; v <= 12; v++) {
    for (let i = 0; i < v; i++) {
      deck.push({ type: 'number', value: v, label: String(v) });
    }
  }

  // Bonus (6)
  deck.push({ type: 'bonus', kind: 'x2', label: 'x2' });
  deck.push({ type: 'bonus', kind: '+2', value: 2, label: '+2' });
  deck.push({ type: 'bonus', kind: '+4', value: 4, label: '+4' });
  deck.push({ type: 'bonus', kind: '+6', value: 6, label: '+6' });
  deck.push({ type: 'bonus', kind: '+8', value: 8, label: '+8' });
  deck.push({ type: 'bonus', kind: '+10', value: 10, label: '+10' });

  // Specials (9, 3 each)
  for (let i = 0; i < 3; i++) deck.push({ type: 'special', kind: 'STOP', label: 'STOP' });
  for (let i = 0; i < 3; i++) deck.push({ type: 'special', kind: 'THREE', label: '3' });
  for (let i = 0; i < 3; i++) deck.push({ type: 'special', kind: 'SECOND', label: 'SC' });

  return shuffle(deck);
}

function countByValue(drawPile) {
  // For AI: counts remaining cards by number value and total cards
  const counts = {
    total: drawPile.length,
    numbers: Array(13).fill(0),
    bonus: 0,
    special: 0,
  };
  for (const c of drawPile) {
    if (c.type === 'number') counts.numbers[c.value]++;
    else if (c.type === 'bonus') counts.bonus++;
    else if (c.type === 'special') counts.special++;
  }
  return counts;
}
