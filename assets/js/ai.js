const AI_PROFILES = [
  { name: "Prudent",  icon: "bi-shield-check", risk: 0.25 },
  { name: "Équilibré",icon: "bi-sliders",      risk: 0.50 },
  { name: "Agressif", icon: "bi-fire",         risk: 0.75 },
  { name: "Chaotique",icon: "bi-dice-5",       risk: 0.60 }
];

function pickAIProfile() {
  // Légère pondération : équilibré un peu plus fréquent
  const bag = [0,1,1,2,3];
  return AI_PROFILES[bag[Math.floor(Math.random()*bag.length)]];
}

function aiChooseStopOrDraw(player, game) {
  // Heuristique simple mais solide :
  // - calcule score actuel si stop
  // - calcule proba de saut sur une pioche (approx)
  // - compare avec profil de risque et situation (retard/avance/près des 200)
  const counts = countByValue(game.drawPile);
  const inHand = new Set(player.numbers);
  let bustCount = 0;
  for (const v of inHand) bustCount += counts.numbers[v];

  const total = Math.max(1, counts.total);
  let bustChance = bustCount / total;

  // Seconde chance amortit le premier saut
  if (player.hasSecondChance) bustChance *= 0.35;

  const roundScore = computeRoundScore(player);

  // Si 6 numéros uniques, tenter Flip7 plus souvent
  const wantsFlip7 = player.numbers.length === 6;

  // Ajustements contextuels
  const targetToWin = 200;
  const remainingTo200 = targetToWin - player.totalScore;
  const pressure = remainingTo200 <= 35 ? 0.12 : 0.0; // proche de 200 → plus agressif

  const risk = clamp(player.ai.risk + pressure, 0.05, 0.95);

  // seuils
  const maxBust = 0.18 + (risk * 0.30);           // tolérance au risque
  const stopScore = 18 + Math.round(risk * 25);   // stop plus tard si risque élevé

  if (wantsFlip7 && bustChance < (maxBust + 0.10)) return 'draw';

  // Si score déjà bon et bust chance haute, stop
  if (roundScore >= stopScore && bustChance > maxBust) return 'stop';

  // Si bust chance très faible, continuer souvent
  if (bustChance < (0.08 + risk*0.10)) return 'draw';

  // Décision probabiliste (chaotique)
  const desire = (roundScore / (stopScore+1)) * 0.45 + (bustChance / (maxBust+0.001)) * 0.55;
  const noise = (player.ai.name === "Chaotique") ? (Math.random()*0.25 - 0.12) : 0;
  const pStop = clamp(desire + (1-risk)*0.10 + noise, 0, 1);

  return (Math.random() < pStop) ? 'stop' : 'draw';
}

function aiChooseTargetForStop(actor, game) {
  // Stop : cible l'adversaire le plus “dangereux” (score de manche élevé ou proche de Flip7)
  const candidates = game.players.filter(p => p.inRound && p.id !== actor.id);
  if (candidates.length === 0) return actor.id; // seul → se cibler

  let best = candidates[0];
  let bestScore = -9999;

  for (const p of candidates) {
    const s = computeRoundScore(p) + (p.numbers.length === 6 ? 12 : 0) + (p.totalScore/50);
    if (s > bestScore) { bestScore = s; best = p; }
  }
  return best.id;
}

function aiChooseTargetForThree(actor, game) {
  // Trois à la suite : cible celui qui a la proba de saut la plus haute
  const candidates = game.players.filter(p => p.inRound);
  if (candidates.length === 1) return actor.id;

  let best = candidates[0];
  let bestScore = -9999;

  const counts = countByValue(game.drawPile);
  const total = Math.max(1, counts.total);

  for (const p of candidates) {
    const inHand = new Set(p.numbers);
    let bustCount = 0;
    for (const v of inHand) bustCount += counts.numbers[v];
    let bustChance = bustCount / total;
    if (p.hasSecondChance) bustChance *= 0.35;

    // on veut un max de risque de saut
    let score = bustChance * 100;

    // bonus si la personne est “greedy”
    score += computeRoundScore(p) * 0.6;
    score += (p.numbers.length === 6 ? 20 : 0);

    // éviter de trop s'auto-cibler si pas nécessaire
    if (p.id === actor.id) score -= 8;

    if (score > bestScore) { bestScore = score; best = p; }
  }

  return best.id;
}

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
