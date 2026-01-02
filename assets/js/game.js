// ============ UI helpers ============
let targetModal, targetModalEl;

function $(id){ return document.getElementById(id); }

function logLine(html) {
  const box = $('log');
  const div = document.createElement('div');
  div.className = 'log-line';
  div.innerHTML = html;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function clearLog(){ $('log').innerHTML = ""; }

function cardToMiniEl(card, faceDown=false) {
  const el = document.createElement('div');

  let cls = 'mini-card ';
  if (card.type === 'number') cls += 'num';
  else if (card.type === 'bonus') cls += 'bonus';
  else if (card.type === 'special') {
    cls += (card.kind === 'SECOND') ? 'sc' : 'special';
  }
  if (faceDown) cls += ' facedown';
  el.className = cls;

  let top = '';
  let val = '';
  let tag = '';

  if (card.type === 'number') {
    top = 'Numéro';
    val = String(card.value);
    tag = (card.value === 0) ? '0 pt' : `${card.value} pts`;
  } else if (card.type === 'bonus') {
    top = 'Bonus';
    val = card.kind;
    tag = (card.kind === 'x2') ? 'Numéros ×2' : 'Ajout';
  } else {
    top = 'Spéciale';
    val = card.kind === 'STOP' ? 'STOP' : (card.kind === 'THREE' ? '3' : 'SC');
    tag = (card.kind === 'STOP') ? 'Cibler' : (card.kind === 'THREE' ? '3 cartes' : 'Anti-saut');
  }

  el.innerHTML = `
    <div class="top">${top}</div>
    <div class="val">${val}</div>
    <div class="tag">${tag}</div>
  `;
  return el;
}

// ============ Game rules helpers ============
function computeRoundScore(player) {
  // Totalisez d’abord la valeur des cartes Numéro.
  let sumNumbers = player.numbers.reduce((a,v)=>a+v, 0);

  // x2 double seulement les numéros
  if (player.bonuses.some(b => b.type==='bonus' && b.kind==='x2')) {
    sumNumbers *= 2;
  }

  // Ajoutez ensuite les +X
  let add = 0;
  for (const b of player.bonuses) {
    if (b.type==='bonus' && b.kind.startsWith('+')) add += (b.value || 0);
  }

  // Flip7 bonus
  const flip7 = player.didFlip7 ? 15 : 0;

  return sumNumbers + add + flip7;
}

function hasDuplicateNumber(player, value) {
  return player.numbers.includes(value);
}

function hasFlip7(player) {
  // Flip 7 = 7 cartes numéro différentes
  const uniq = new Set(player.numbers);
  return uniq.size >= 7;
}

// ============ Core state ============
const game = {
  players: [],
  round: 1,
  dealerIndex: 0,
  turnIndex: 0,
  drawPile: [],
  discardPile: [],
  fastAI: false,
  phase: 'setup', // setup | playing | roundEnd | gameOver
  awaitingHuman: false,
  pendingAction: null, // for modal targeting
};

function createPlayer(id, name, isHuman=false) {
  const profile = isHuman ? null : pickAIProfile();
  return {
    id,
    name,
    isHuman,
    ai: profile,
    totalScore: 0,

    // round state
    inRound: true,       // can act
    stopped: false,      // chose stop or got stopped
    busted: false,       // duplicated and no SC
    didFlip7: false,

    numbers: [],         // list of number values (unique normally)
    bonuses: [],         // bonus cards
    specials: [],        // stop/three/second (for display)
    hasSecondChance: false,

    gotInitialCard: false,
  };
}

function resetRoundState(p) {
  p.inRound = true;
  p.stopped = false;
  p.busted = false;
  p.didFlip7 = false;
  p.numbers = [];
  p.bonuses = [];
  p.specials = [];
  p.hasSecondChance = false;
  p.gotInitialCard = false;
}

function refillIfNeeded() {
  if (game.drawPile.length > 0) return;
  if (game.discardPile.length === 0) return; // rare
  shuffle(game.discardPile);
  game.drawPile = game.discardPile;
  game.discardPile = [];
  logLine(`<span class="text-info"><i class="bi bi-shuffle"></i> Pioche vide : mélange de la défausse.</span>`);
}

function drawCard() {
  refillIfNeeded();
  return game.drawPile.shift();
}

function moveRoundCardsToDiscard() {
  for (const p of game.players) {
    // On met toutes les cartes utilisées de côté (défausse)
    // (Seconde chance est aussi défaussée fin de manche)
    const all = [];
    for (const v of p.numbers) all.push({ type:'number', value:v, label:String(v) });
    for (const b of p.bonuses) all.push(b);
    for (const s of p.specials) all.push(s);
    if (p.hasSecondChance) {
      // Si encore active sans utilisation, elle est défaussée aussi
      all.push({ type:'special', kind:'SECOND', label:'SC' });
      p.hasSecondChance = false;
    }
    game.discardPile.push(...all);
  }
}

// ============ Turn / flow ============
function nextActivePlayerIndex(fromIdx) {
  const n = game.players.length;
  for (let step = 1; step <= n; step++) {
    const i = (fromIdx + step) % n;
    if (game.players[i].inRound) return i;
  }
  return -1;
}

function countActivePlayers() {
  return game.players.filter(p => p.inRound).length;
}

function startNewMatch(opponentsCount) {
  game.players = [];
  game.round = 1;
  game.phase = 'playing';
  game.fastAI = false;

  game.players.push(createPlayer('H', 'Vous', true));
  for (let i=1; i<=opponentsCount; i++){
    const p = createPlayer('AI'+i, 'IA '+i, false);
    game.players.push(p);
  }

  game.dealerIndex = Math.floor(Math.random() * game.players.length);

  // Deck init
  game.drawPile = buildOfficialDeck();
  game.discardPile = [];

  logLine(`<strong>Partie lancée.</strong> Donneur initial: <span class="text-warning">${game.players[game.dealerIndex].name}</span>.`);
  startRound();
}

function startRound() {
  // reset players round state
  for (const p of game.players) resetRoundState(p);

  logLine(`<span class="text-warning"><i class="bi bi-stars"></i> Manche ${game.round} — Donneur: ${game.players[game.dealerIndex].name}</span>`);

  // Initial distribution: starting from player to left of dealer, clockwise, including dealer
  const order = [];
  const n = game.players.length;
  for (let k=1; k<=n; k++){
    order.push((game.dealerIndex + k) % n);
  }

  // We need to ensure each player gets "offered" an initial card (unless they end up with none due to special chain).
  // We'll loop over order and give each player 1 card, resolving specials immediately.
  for (const idx of order) {
    if (!game.players[idx].gotInitialCard) {
      giveCardToPlayer(game.players[idx], { context: 'initial' });
      game.players[idx].gotInitialCard = true;
    }
  }

  // Turn starts from left of dealer
  game.turnIndex = (game.dealerIndex + 1) % n;
  // Find first active
  if (!game.players[game.turnIndex].inRound) {
    const ni = nextActivePlayerIndex(game.turnIndex - 1);
    if (ni >= 0) game.turnIndex = ni;
  }

  renderAll();
  tick();
}

function endRound(reason) {
  game.phase = 'roundEnd';

  logLine(`<span class="text-warning"><i class="bi bi-flag"></i> Fin de manche</span> — ${reason}`);

  // scoring
  for (const p of game.players) {
    if (!p.busted) {
      const rs = computeRoundScore(p);
      p.totalScore += rs;
      logLine(`+ <strong>${p.name}</strong> marque <strong>${rs}</strong> (total: <strong>${p.totalScore}</strong>).`);
    } else {
      logLine(`✖ <strong>${p.name}</strong> a sauté : <strong>0</strong> point.`);
    }
  }

  // discard round cards
  moveRoundCardsToDiscard();

  // Check end of game (200+ reached)
  const reached = game.players.some(p => p.totalScore >= 200);
  if (reached) {
    const max = Math.max(...game.players.map(p => p.totalScore));
    const winners = game.players.filter(p => p.totalScore === max);

    if (winners.length === 1) {
      game.phase = 'gameOver';
      logLine(`<span class="text-success"><i class="bi bi-trophy-fill"></i> ${winners[0].name} gagne avec ${max} points !</span>`);
      renderAll();
      lockControls();
      return;
    } else {
      // Tie-break: new round for tied (simple: we keep everyone but announce)
      logLine(`<span class="text-info"><i class="bi bi-lightning"></i> Égalité à ${max}. Nouvelle manche de départage.</span>`);
    }
  }

  // Next dealer: pass remaining deck to left => dealer moves left
  game.dealerIndex = (game.dealerIndex + 1) % game.players.length;
  game.round += 1;

  renderAll();

  // Auto start next round after a short pause
  setTimeout(() => {
    if (game.phase !== 'gameOver') {
      game.phase = 'playing';
      startRound();
    }
  }, game.fastAI ? 400 : 900);
}

function lockControls() {
  $('btnDraw').disabled = true;
  $('btnStop').disabled = true;
}

// ============ Actions ============
function playerStop(p) {
  p.inRound = false;
  p.stopped = true;
  logLine(`<strong>${p.name}</strong> dit <span class="text-warning">STOP</span>.`);
}

function playerBust(p) {
  p.inRound = false;
  p.busted = true;
  logLine(`<strong>${p.name}</strong> <span class="text-danger">saute</span> (doublon).`);
}

function addCardToPlayer(p, card) {
  if (card.type === 'number') {
    p.numbers.push(card.value);
  } else if (card.type === 'bonus') {
    p.bonuses.push(card);
  } else if (card.type === 'special') {
    p.specials.push(card);
  }
}

function giveCardToPlayer(p, opts = {}) {
  // opts: { context: 'initial'|'turn'|'three' }
  const card = drawCard();
  if (!card) return;

  if (card.type === 'number') {
    const v = card.value;

    // duplicate => bust unless second chance
    if (hasDuplicateNumber(p, v)) {
      if (p.hasSecondChance) {
        // use SC: discard the duplicate + SC
        p.hasSecondChance = false;
        game.discardPile.push({ type:'special', kind:'SECOND', label:'SC' });
        game.discardPile.push(card);

        logLine(`<strong>${p.name}</strong> pioche <strong>${v}</strong> (doublon) mais utilise <span class="text-success">Seconde chance</span> → il reste dans la manche.`);
        renderAll();
        return;
      } else {
        // bust
        game.discardPile.push(card);
        playerBust(p);
        renderAll();
        return;
      }
    }

    addCardToPlayer(p, card);
    logLine(`<strong>${p.name}</strong> pioche un <strong>${v}</strong>.`);

    if (hasFlip7(p)) {
      p.didFlip7 = true;
      // fin de manche immédiate
      endRound(`${p.name} réalise <strong>Flip 7</strong> (+15).`);
      return;
    }

  } else if (card.type === 'bonus') {
    addCardToPlayer(p, card);
    logLine(`<strong>${p.name}</strong> reçoit un bonus <strong>${card.label}</strong>.`);

  } else if (card.type === 'special') {
    addCardToPlayer(p, card);

    if (card.kind === 'SECOND') {
      handleSecondChance(p);
    } else if (card.kind === 'STOP') {
      handleStopSpecial(p);
    } else if (card.kind === 'THREE') {
      handleThreeSpecial(p);
    }
  }

  renderAll();
}

function handleSecondChance(p) {
  // A player cannot have two SC; if already has, give it to another inRound player without SC if possible
  if (!p.hasSecondChance) {
    p.hasSecondChance = true;
    logLine(`<strong>${p.name}</strong> garde une <span class="text-success">Seconde chance</span>.`);
    return;
  }

  // Must give to another inRound player that doesn't have one
  const candidates = game.players.filter(x => x.inRound && !x.hasSecondChance && x.id !== p.id);
  if (candidates.length > 0) {
    const target = p.isHuman ? candidates[0] : candidates[Math.floor(Math.random()*candidates.length)];
    target.hasSecondChance = true;
    logLine(`<strong>${p.name}</strong> a déjà une Seconde chance → il la donne à <strong>${target.name}</strong>.`);
  } else {
    logLine(`<strong>${p.name}</strong> a déjà une Seconde chance → personne à qui la donner, elle est défaussée.`);
    game.discardPile.push({ type:'special', kind:'SECOND', label:'SC' });
  }
}

function openTargetModal(title, desc, candidates, onPick) {
  $('targetModalTitle').textContent = title;
  $('targetModalDesc').textContent = desc;
  const box = $('targetButtons');
  box.innerHTML = '';

  for (const p of candidates) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline-light';
    btn.innerHTML = `<strong>${p.name}</strong> <span class="text-secondary">(${computeRoundScore(p)} pts manche, ${p.numbers.length} num.)</span>`;
    btn.onclick = () => {
      targetModal.hide();
      onPick(p);
    };
    box.appendChild(btn);
  }

  targetModal.show();
}

function handleStopSpecial(actor) {
  // Target a player still inRound; if actor is alone, must target self.
  logLine(`<strong>${actor.name}</strong> reçoit <strong>STOP</strong> (spéciale) → choisir une cible.`);

  const candidates = game.players.filter(p => p.inRound);
  if (candidates.length === 1) {
    playerStop(actor);
    renderAll();
    return;
  }

  if (actor.isHuman) {
    game.awaitingHuman = true;
    openTargetModal(
      "STOP — Choisir une cible",
      "La cible sort immédiatement de la manche (elle scorera en fin de manche).",
      candidates.filter(p => p.inRound),
      (picked) => {
        game.awaitingHuman = false;
        playerStop(picked);
        logLine(`→ Cible STOP : <strong>${picked.name}</strong>.`);
        renderAll();
        tick();
      }
    );
  } else {
    const targetId = aiChooseTargetForStop(actor, game);
    const picked = game.players.find(p => p.id === targetId) || actor;
    playerStop(picked);
    logLine(`→ Cible STOP : <strong>${picked.name}</strong>.`);
  }
}

function handleThreeSpecial(actor) {
  logLine(`<strong>${actor.name}</strong> reçoit <strong>Trois à la suite</strong> → choisir une cible (3 cartes forcées).`);

  const candidates = game.players.filter(p => p.inRound);
  if (candidates.length === 1) {
    doThreeSequence(actor, actor);
    return;
  }

  if (actor.isHuman) {
    game.awaitingHuman = true;
    openTargetModal(
      "TROIS À LA SUITE — Cibler",
      "Le donneur distribue les 3 prochaines cartes à la cible (arrêt si elle saute ou fait Flip 7).",
      candidates,
      (picked) => {
        game.awaitingHuman = false;
        doThreeSequence(actor, picked);
        tick();
      }
    );
  } else {
    const targetId = aiChooseTargetForThree(actor, game);
    const picked = game.players.find(p => p.id === targetId) || actor;
    doThreeSequence(actor, picked);
  }
}

function doThreeSequence(actor, target) {
  logLine(`→ <strong>${actor.name}</strong> cible <strong>${target.name}</strong> pour <strong>3 cartes</strong>.`);

  const pendingSpecials = [];
  for (let i=0; i<3; i++) {
    if (!target.inRound) break; // if target already out (stopped/busted)

    const card = drawCard();
    if (!card) break;

    // If number: apply immediately via normal path (but without extra log duplicates)
    if (card.type === 'number') {
      // duplicate check uses SC as well
      if (hasDuplicateNumber(target, card.value)) {
        if (target.hasSecondChance) {
          target.hasSecondChance = false;
          game.discardPile.push({ type:'special', kind:'SECOND', label:'SC' });
          game.discardPile.push(card);
          logLine(`<strong>${target.name}</strong> reçoit <strong>${card.value}</strong> (doublon) mais utilise <span class="text-success">Seconde chance</span>.`);
          renderAll();
          continue;
        } else {
          game.discardPile.push(card);
          playerBust(target);
          renderAll();
          logLine(`<span class="text-danger">Interruption</span> : ${target.name} a sauté pendant Trois à la suite.`);
          break;
        }
      }

      addCardToPlayer(target, card);
      logLine(`<strong>${target.name}</strong> reçoit <strong>${card.value}</strong> (forcé).`);

      if (hasFlip7(target)) {
        target.didFlip7 = true;
        endRound(`${target.name} réalise <strong>Flip 7</strong> (+15) pendant Trois à la suite.`);
        return;
      }

    } else if (card.type === 'bonus') {
      addCardToPlayer(target, card);
      logLine(`<strong>${target.name}</strong> reçoit bonus <strong>${card.label}</strong> (forcé).`);
    } else {
      // Special revealed during effect: counts among 3 but applied AFTER
      addCardToPlayer(target, card);
      pendingSpecials.push(card);
      logLine(`<strong>${target.name}</strong> révèle une spéciale <strong>${card.kind}</strong> (application après les 3).`);
    }
  }

  renderAll();

  // Apply pending specials (in order)
  for (const sp of pendingSpecials) {
    if (game.phase === 'gameOver') return;

    // If target busted during the sequence, the rules say it must still target another player still in the round
    // We'll choose a "resolver" = target (even if busted), and allow it to target someone inRound.
    const resolver = target;

    if (sp.kind === 'SECOND') {
      // Second chance just goes to resolver if possible
      if (!resolver.hasSecondChance && resolver.inRound) {
        resolver.hasSecondChance = true;
        logLine(`<strong>${resolver.name}</strong> garde une <span class="text-success">Seconde chance</span> (après Trois à la suite).`);
      } else {
        // give to someone inRound without SC if possible
        const cand = game.players.filter(p => p.inRound && !p.hasSecondChance);
        if (cand.length > 0) {
          const t = cand[Math.floor(Math.random()*cand.length)];
          t.hasSecondChance = true;
          logLine(`<strong>${resolver.name}</strong> donne une <span class="text-success">Seconde chance</span> à <strong>${t.name}</strong>.`);
        } else {
          game.discardPile.push({ type:'special', kind:'SECOND', label:'SC' });
          logLine(`Seconde chance défaussée (personne éligible).`);
        }
      }
    }

    if (sp.kind === 'STOP') {
      // We re-use handler but without re-adding card (already in specials)
      handleStopSpecial(resolver);
    }

    if (sp.kind === 'THREE') {
      handleThreeSpecial(resolver);
    }

    renderAll();
  }
}

// ============ Rendering ============
function renderAll() {
  // header
  $('uiRound').textContent = String(game.round);
  $('uiDealerName').textContent = game.players[game.dealerIndex]?.name ?? '?';
  $('uiDrawCount').textContent = String(game.drawPile.length);
  $('uiDiscardCount').textContent = String(game.discardPile.length);

  const turnP = game.players[game.turnIndex];
  $('uiTurnName').textContent = turnP ? turnP.name : '—';

  if (!turnP) {
    $('uiStatusPill').textContent = '—';
  } else {
    let s = '—';
    if (!turnP.inRound && turnP.busted) s = 'Sauté';
    else if (!turnP.inRound && turnP.stopped) s = 'Stoppé';
    else s = 'En jeu';
    $('uiStatusPill').textContent = s;
  }

  // players grid
  const grid = $('playersGrid');
  grid.innerHTML = '';
  for (let i=0; i<game.players.length; i++){
    const p = game.players[i];
    const card = document.createElement('div');
    card.className = 'player-card';

    const isTurn = (i === game.turnIndex && game.phase === 'playing');
    const dealer = (i === game.dealerIndex);

    const aiBadge = p.isHuman
      ? `<span class="badge bg-primary"><i class="bi bi-person"></i> Humain</span>`
      : `<span class="badge bg-secondary"><i class="bi ${p.ai.icon}"></i> ${p.ai.name}</span>`;

    const statusBadge = p.busted
      ? `<span class="badge bg-danger">Sauté</span>`
      : p.stopped
        ? `<span class="badge bg-light text-dark">Stop</span>`
        : p.inRound
          ? `<span class="badge bg-success">Actif</span>`
          : `<span class="badge bg-secondary">Out</span>`;

    const turnBadge = isTurn ? `<span class="badge bg-info text-dark pill-turn">À jouer</span>` : '';
    const dealerBadge = dealer ? `<span class="badge bg-warning text-dark"><i class="bi bi-star-fill"></i> Donneur</span>` : '';

    const faceDown = p.busted || p.stopped; // on “retourne” pour indiquer qu'il est sorti

    const numbersRow = document.createElement('div');
    numbersRow.className = 'cards-row';
    for (const v of p.numbers) numbersRow.appendChild(cardToMiniEl({ type:'number', value:v }, faceDown));

    const bonusesRow = document.createElement('div');
    bonusesRow.className = 'cards-row mt-2';
    for (const b of p.bonuses) bonusesRow.appendChild(cardToMiniEl(b, faceDown));

    const specialsRow = document.createElement('div');
    specialsRow.className = 'cards-row mt-2';
    for (const s of p.specials) specialsRow.appendChild(cardToMiniEl(s, faceDown));

    // show second chance as a small chip
    const scChip = p.hasSecondChance
      ? `<span class="badge bg-success"><i class="bi bi-life-preserver"></i> Seconde chance</span>`
      : `<span class="badge bg-dark border border-secondary text-secondary">—</span>`;

    const roundScore = p.busted ? 0 : computeRoundScore(p);

    card.innerHTML = `
      <div class="player-head">
        <div class="player-name">
          <span class="opacity-75">${p.isHuman ? '🙂' : '🤖'}</span>
          <span>${p.name}</span>
          ${turnBadge}
        </div>
        <div class="player-meta">
          ${dealerBadge}
          ${aiBadge}
          ${statusBadge}
          <span class="badge bg-dark border border-secondary">Manche: <strong>${roundScore}</strong></span>
          ${scChip}
        </div>
      </div>
      <div class="text-secondary small mb-2">Numéros</div>
    `;
    card.appendChild(numbersRow);

    const bTitle = document.createElement('div');
    bTitle.className = 'text-secondary small mt-2';
    bTitle.textContent = 'Bonus';
    card.appendChild(bTitle);
    card.appendChild(bonusesRow);

    const sTitle = document.createElement('div');
    sTitle.className = 'text-secondary small mt-2';
    sTitle.textContent = 'Spéciales';
    card.appendChild(sTitle);
    card.appendChild(specialsRow);

    if (isTurn) card.style.outline = '2px solid rgba(13,202,240,0.45)';
    grid.appendChild(card);
  }

  // score list
  const list = $('scoreList');
  list.innerHTML = '';
  const sorted = [...game.players].sort((a,b)=>b.totalScore - a.totalScore);
  for (const p of sorted) {
    const row = document.createElement('div');
    row.className = 'd-flex justify-content-between align-items-center p-2 rounded-3 border border-secondary';
    row.style.background = 'rgba(0,0,0,0.25)';
    row.innerHTML = `
      <div class="d-flex align-items-center gap-2">
        <strong>${p.name}</strong>
        ${p.isHuman ? `<span class="badge bg-primary">Vous</span>` : `<span class="badge bg-secondary">${p.ai.name}</span>`}
      </div>
      <div class="d-flex gap-2 align-items-center">
        <span class="text-secondary small">Total</span>
        <span class="badge bg-warning text-dark fs-6">${p.totalScore}</span>
      </div>
    `;
    list.appendChild(row);
  }

  // controls lock/unlock
  const turnP2 = game.players[game.turnIndex];
  const humanTurn = (turnP2 && turnP2.isHuman && turnP2.inRound && game.phase === 'playing' && !game.awaitingHuman);

  $('btnDraw').disabled = !humanTurn;
  $('btnStop').disabled = !humanTurn;
}

function tick() {
  if (game.phase !== 'playing') return;
  if (game.awaitingHuman) return;

  // if no active players, end round
  if (countActivePlayers() === 0) {
    endRound("Tous les joueurs sont sortis (Stop) ou ont sauté.");
    return;
  }

  const p = game.players[game.turnIndex];
  renderAll();

  if (!p || !p.inRound) {
    const ni = nextActivePlayerIndex(game.turnIndex);
    if (ni === -1) endRound("Plus de joueurs actifs.");
    else {
      game.turnIndex = ni;
      tick();
    }
    return;
  }

  $('uiTurnName').textContent = p.name;

  if (p.isHuman) {
    // wait for button click
    return;
  }

  // AI action with delay
  const delay = game.fastAI ? 250 : 650;
  setTimeout(() => {
    if (game.phase !== 'playing') return;
    if (!p.inRound) { advanceTurn(); return; }

    const choice = aiChooseStopOrDraw(p, game);
    if (choice === 'stop') {
      playerStop(p);
    } else {
      giveCardToPlayer(p, { context: 'turn' });
      // giveCardToPlayer may end round (flip7) or bust etc
      if (game.phase !== 'playing') return;
    }
    advanceTurn();
  }, delay);
}

function advanceTurn() {
  if (game.phase !== 'playing') return;

  // If no active players -> end round
  if (countActivePlayers() === 0) {
    endRound("Tous les joueurs sont sortis (Stop) ou ont sauté.");
    return;
  }

  const ni = nextActivePlayerIndex(game.turnIndex);
  if (ni === -1) {
    endRound("Plus de joueurs actifs.");
    return;
  }
  game.turnIndex = ni;
  renderAll();
  tick();
}

// ============ Human controls ============
function onHumanDraw() {
  const p = game.players[game.turnIndex];
  if (!p || !p.isHuman || !p.inRound) return;

  giveCardToPlayer(p, { context: 'turn' });
  if (game.phase !== 'playing') return;

  // after draw, turn passes (like normal)
  advanceTurn();
}

function onHumanStop() {
  const p = game.players[game.turnIndex];
  if (!p || !p.isHuman || !p.inRound) return;

  playerStop(p);
  advanceTurn();
}

// ============ Boot ============
function showScreen(which) {
  $('screenSetup').classList.toggle('d-none', which !== 'setup');
  $('screenGame').classList.toggle('d-none', which !== 'game');
}

function init() {
  targetModalEl = document.getElementById('targetModal');
  targetModal = new bootstrap.Modal(targetModalEl, { backdrop: 'static' });

  $('btnStart').addEventListener('click', () => {
    clearLog();
    const opp = parseInt($('selectOpponents').value, 10);
    showScreen('game');
    startNewMatch(opp);
  });

  $('btnNewGame').addEventListener('click', () => {
    location.reload();
  });

  $('btnDraw').addEventListener('click', onHumanDraw);
  $('btnStop').addEventListener('click', onHumanStop);

  $('btnClearLog').addEventListener('click', clearLog);

  $('btnFast').addEventListener('click', () => {
    game.fastAI = !game.fastAI;
    $('btnFast').classList.toggle('btn-outline-info', !game.fastAI);
    $('btnFast').classList.toggle('btn-info', game.fastAI);
    $('btnFast').classList.toggle('text-dark', game.fastAI);
    logLine(game.fastAI
      ? `<span class="text-info"><i class="bi bi-speedometer"></i> IA plus rapide activée.</span>`
      : `<span class="text-info"><i class="bi bi-speedometer"></i> IA plus rapide désactivée.</span>`
    );
  });

  showScreen('setup');
}

window.addEventListener('DOMContentLoaded', init);
