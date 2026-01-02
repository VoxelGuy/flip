<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Flip7 - Solo vs IA</title>

  <!-- Bootstrap 5 -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">

  <!-- Bootstrap Icons -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">

  <link href="assets/css/style.css" rel="stylesheet">
</head>
<body class="bg-app">

<nav class="navbar navbar-expand-lg navbar-dark bg-dark border-bottom border-secondary sticky-top">
  <div class="container-fluid">
    <span class="navbar-brand d-flex align-items-center gap-2">
      <span class="badge bg-warning text-dark">Flip7</span>
    </span>

    <div class="d-flex align-items-center gap-2">
      <button id="btnNewGame" class="btn btn-outline-light btn-sm">
        <i class="bi bi-arrow-clockwise"></i> Nouvelle partie
      </button>

      <button class="btn btn-outline-info btn-sm" data-bs-toggle="modal" data-bs-target="#rulesModal">
        <i class="bi bi-book"></i> Règles (résumé)
      </button>
    </div>
  </div>
</nav>

<main class="container-fluid py-3">

  <!-- SETUP -->
  <section id="screenSetup" class="mx-auto" style="max-width: 880px;">
    <div class="card card-glass">
      <div class="card-body p-4">
        <h1 class="h3 mb-2">Lancer une partie</h1>
        <p class="text-secondary mb-4">Choisis le nombre d’adversaires, puis démarre. Les IA ont des personnalités aléatoires.</p>

        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-6">
            <label class="form-label">Nombre d’adversaires</label>
            <select id="selectOpponents" class="form-select">
              <option value="1">1 adversaire</option>
              <option value="2" selected>2 adversaires</option>
              <option value="3">3 adversaires</option>
              <option value="4">4 adversaires</option>
              <option value="5">5 adversaires</option>
            </select>
          </div>

          <div class="col-12 col-md-6 d-grid">
            <button id="btnStart" class="btn btn-warning btn-lg">
              <i class="bi bi-play-fill"></i> Démarrer
            </button>
          </div>
        </div>

        <hr class="border-secondary my-4">

        <div class="row g-3">
          <div class="col-12 col-md-6">
            <div class="p-3 rounded-4 bg-dark border border-secondary">
              <div class="d-flex align-items-center gap-2 mb-2">
                <i class="bi bi-cpu"></i><strong>Personnalités IA</strong>
              </div>
              <ul class="mb-0 text-secondary">
                <li><strong>Prudent</strong> : stop tôt, joue safe.</li>
                <li><strong>Équilibré</strong> : décisions “raisonnables”.</li>
                <li><strong>Agressif</strong> : pousse la chance.</li>
                <li><strong>Chaotique</strong> : parfois inexplicable 😄</li>
              </ul>
            </div>
          </div>

          <div class="col-12 col-md-6">
            <div class="p-3 rounded-4 bg-dark border border-secondary">
              <div class="d-flex align-items-center gap-2 mb-2">
                <i class="bi bi-layers"></i><strong>Paquet officiel</strong>
              </div>
              <div class="text-secondary">
                79 cartes Numéro (0–12), 6 Bonus (x2, +2/+4/+6/+8/+10), 9 Spéciales (Stop / Trois à la suite / Seconde chance, ×3).
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </section>

  <!-- GAME -->
  <section id="screenGame" class="d-none">
    <div class="row g-3">
      <!-- Left: board -->
      <div class="col-12 col-xl-8">
        <div class="card card-glass">
          <div class="card-body">
            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div class="d-flex align-items-center gap-2">
                <span class="badge bg-warning text-dark">Manche <span id="uiRound">1</span></span>
                <span class="badge bg-secondary">Donneur: <span id="uiDealerName">?</span></span>
                <span class="badge bg-dark border border-secondary">Pioche: <span id="uiDrawCount">0</span></span>
                <span class="badge bg-dark border border-secondary">Défausse: <span id="uiDiscardCount">0</span></span>
              </div>

              <div class="d-flex align-items-center gap-2">
                <span class="badge bg-info text-dark">
                  Tour: <span id="uiTurnName">?</span>
                </span>
                <span id="uiStatusPill" class="badge bg-dark border border-secondary">—</span>
              </div>
            </div>

            <div id="playersGrid" class="players-grid"></div>

            <hr class="border-secondary my-3">

            <div class="d-flex flex-wrap gap-2">
              <button id="btnDraw" class="btn btn-warning">
                <i class="bi bi-plus-circle"></i> Encore (piocher)
              </button>
              <button id="btnStop" class="btn btn-outline-light">
                <i class="bi bi-hand"></i> Stop (sortir)
              </button>
              <button id="btnFast" class="btn btn-outline-info ms-auto">
                <i class="bi bi-speedometer"></i> IA plus rapide
              </button>
            </div>

            <div class="mt-2 text-secondary small">
              Astuce: le journal à droite explique toutes les actions (Stop / Trois à la suite / Seconde chance…).
            </div>
          </div>
        </div>
      </div>

      <!-- Right: log + scoreboard -->
      <div class="col-12 col-xl-4">
        <div class="card card-glass mb-3">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center">
              <strong><i class="bi bi-trophy"></i> Scores</strong>
              <span class="text-secondary small">Objectif: 200+</span>
            </div>
            <div id="scoreList" class="mt-3 d-grid gap-2"></div>
          </div>
        </div>

        <div class="card card-glass">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center">
              <strong><i class="bi bi-journal-text"></i> Journal</strong>
              <button id="btnClearLog" class="btn btn-sm btn-outline-secondary">Vider</button>
            </div>
            <div id="log" class="log-box mt-3"></div>
          </div>
        </div>
      </div>
    </div>
  </section>

</main>

<!-- Target modal (for specials) -->
<div class="modal fade" id="targetModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content bg-dark text-light border border-secondary">
      <div class="modal-header border-secondary">
        <h5 class="modal-title" id="targetModalTitle">Choisir une cible</h5>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fermer"></button>
      </div>
      <div class="modal-body">
        <div id="targetModalDesc" class="text-secondary mb-3"></div>
        <div id="targetButtons" class="d-grid gap-2"></div>
      </div>
    </div>
  </div>
</div>

<!-- Rules modal -->
<div class="modal fade" id="rulesModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-lg modal-dialog-centered">
    <div class="modal-content bg-dark text-light border border-secondary">
      <div class="modal-header border-secondary">
        <h5 class="modal-title"><i class="bi bi-book"></i> Résumé règles (implémentées)</h5>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fermer"></button>
      </div>
      <div class="modal-body text-secondary">
        <ul>
          <li>Tu choisis <strong>Encore</strong> (piocher) ou <strong>Stop</strong> (sortir et scorer en fin de manche).</li>
          <li>Si tu reçois un <strong>Numéro déjà présent</strong> devant toi → <strong>tu sautes</strong> (0 point cette manche).</li>
          <li><strong>Flip 7</strong> : 7 numéros différents → fin immédiate de manche + <strong>+15</strong> au joueur.</li>
          <li><strong>Bonus</strong> : +2/+4/+6/+8/+10 ajoutés au score ; <strong>x2</strong> double seulement le total des Numéros (pas les bonus, pas le +15).</li>
          <li><strong>Stop</strong> (spéciale) : cible un joueur encore dans la manche, il sort immédiatement (il scorera en fin de manche).</li>
          <li><strong>Trois à la suite</strong> : cible un joueur, le donneur lui donne les 3 prochaines cartes (interrompre si saut/Flip7). Les spéciales révélées pendant l’effet s’appliquent après.</li>
          <li><strong>Seconde chance</strong> : si tu devrais sauter sur un doublon, tu défausses le doublon + seconde chance pour rester.</li>
          <li>La partie s’arrête en fin de manche si au moins un joueur a <strong>200+</strong>. Le plus haut total gagne (égalité → manche de départage).</li>
        </ul>
      </div>
    </div>
  </div>
</div>

<!-- Bootstrap JS -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

<script src="assets/js/deck.js"></script>
<script src="assets/js/ai.js"></script>
<script src="assets/js/game.js"></script>
</body>
</html>
