// =====================================================================
// Spell Tracker - logica do overlay in-game
// =====================================================================

const DDRAGON_BASE = 'https://ddragon.leagueoflegends.com';

// Versao do Data Dragon - vamos puxar dinamicamente na inicializacao
let DDRAGON_VERSION = '14.21.1'; // fallback

// Estado global
let cooldownModifier = 1.0;       // 1.0 normal, 0.9 com Lucidez
let lucidityActive = false;
const enemyState = [];            // [{role, letter, color, championId, spells, spellImageIds, timers: [{remaining, active, intervalId}]}]

// =====================================================================
// Init: pega versao do DDragon, monta UI, conecta poller
// =====================================================================

async function init() {
  await loadDDragonVersion();
  buildUI();
  setupHotkeyListener();
  setupResize();
  startPoller();
  log('overlay iniciado');
}

async function loadDDragonVersion() {
  try {
    const r = await fetch(`${DDRAGON_BASE}/api/versions.json`, { cache: 'force-cache' });
    if (r.ok) {
      const versions = await r.json();
      if (versions && versions[0]) DDRAGON_VERSION = versions[0];
      log(`DDragon version: ${DDRAGON_VERSION}`);
    }
  } catch (e) {
    log(`DDragon version fallback: ${DDRAGON_VERSION}`);
  }
}

function championIconUrl(championId) {
  return `${DDRAGON_BASE}/cdn/${DDRAGON_VERSION}/img/champion/${championId}.png`;
}

function spellIconUrl(spellImageId) {
  if (!spellImageId) return null;
  return `${DDRAGON_BASE}/cdn/${DDRAGON_VERSION}/img/spell/${spellImageId}.png`;
}

// =====================================================================
// Build UI - cria as 5 linhas iniciais com placeholders
// =====================================================================

function buildUI() {
  const container = document.getElementById('rows-container');
  container.innerHTML = '';

  for (let i = 0; i < 5; i++) {
    const enemy = SpellData.DEFAULT_ENEMIES[i];
    const row = document.createElement('div');
    row.className = 'enemy-row';
    row.dataset.index = i;

    const ci = document.createElement('div');
    ci.className = 'ci';
    ci.style.background = enemy.color;
    ci.textContent = enemy.letter;

    const roleLabel = document.createElement('span');
    roleLabel.className = 'role';
    roleLabel.textContent = enemy.role;

    row.appendChild(ci);
    row.appendChild(roleLabel);

    for (let j = 0; j < 2; j++) {
      const btn = document.createElement('button');
      btn.className = 'spell-btn no-icon';
      btn.dataset.row = i;
      btn.dataset.slot = j;
      btn.textContent = SpellData.SPELLS[enemy.spells[j]].letter;
      btn.style.backgroundColor = applyAlpha(SpellData.SPELLS[enemy.spells[j]].color, 0.22);

      const timerSpan = document.createElement('span');
      timerSpan.className = 'timer';
      btn.appendChild(timerSpan);

      btn.addEventListener('click', () => onSpellClick(i, j));
      row.appendChild(btn);
    }

    container.appendChild(row);

    enemyState.push({
      ...enemy,
      championId: null,
      spellImageIds: [null, null],
      timers: [
        { remaining: 0, active: false, intervalId: null },
        { remaining: 0, active: false, intervalId: null },
      ],
    });
  }

  document.getElementById('reset-btn').addEventListener('click', resetAll);
  document.getElementById('lucid-btn').addEventListener('click', toggleLucidity);
  document.getElementById('close-btn').addEventListener('click', closeOverlay);
}

function applyAlpha(hexColor, alpha) {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// =====================================================================
// Update roster - chamado quando o LiveClientPoller detecta mudanca
// =====================================================================

function updateRoster(rawEnemies) {
  const parsed = SpellData.parseRiotEnemies(rawEnemies);
  parsed.forEach((enemy, i) => {
    const row = document.querySelector(`.enemy-row[data-index="${i}"]`);
    if (!row) return;

    const state = enemyState[i];
    state.role = enemy.role;
    state.letter = enemy.letter;
    state.color = enemy.color;
    state.championId = enemy.championId;
    state.spells = enemy.spells;
    state.spellImageIds = enemy.spellImageIds || [null, null];
    state.champion = enemy.champion;

    // Atualiza champion icon
    const ci = row.querySelector('.ci');
    if (enemy.championId) {
      ci.style.backgroundImage = `url('${championIconUrl(enemy.championId)}')`;
      ci.style.background = `url('${championIconUrl(enemy.championId)}') center/cover, ${enemy.color}`;
      ci.textContent = '';
    } else {
      ci.style.background = enemy.color;
      ci.textContent = enemy.letter;
    }

    // Atualiza role label
    row.querySelector('.role').textContent = enemy.role;

    // Atualiza spells
    const spellBtns = row.querySelectorAll('.spell-btn');
    spellBtns.forEach((btn, j) => {
      const spellKey = enemy.spells[j];
      const imageId = state.spellImageIds[j];
      const spellInfo = SpellData.SPELLS[spellKey];

      // Reseta timer se mudou o spell
      const timer = state.timers[j];
      if (timer.active) {
        clearInterval(timer.intervalId);
        timer.active = false;
        timer.remaining = 0;
        btn.classList.remove('active');
      }

      btn.dataset.spellKey = spellKey;
      const url = spellIconUrl(imageId);
      if (url) {
        btn.classList.add('has-icon');
        btn.classList.remove('no-icon');
        btn.style.backgroundImage = `url('${url}')`;
        btn.style.backgroundColor = '';
        btn.textContent = '';
      } else {
        btn.classList.add('no-icon');
        btn.classList.remove('has-icon');
        btn.style.backgroundImage = '';
        btn.style.backgroundColor = applyAlpha(spellInfo.color, 0.22);
        btn.textContent = spellInfo.letter;
      }

      // Re-adiciona o timer span
      let timerSpan = btn.querySelector('.timer');
      if (!timerSpan) {
        timerSpan = document.createElement('span');
        timerSpan.className = 'timer';
        btn.appendChild(timerSpan);
      }
    });
  });

  log('roster atualizado: ' + parsed.map(e => e.champion).join(', '));
}

// =====================================================================
// Spell click handlers
// =====================================================================

function onSpellClick(rowIdx, slotIdx) {
  const state = enemyState[rowIdx];
  const timer = state.timers[slotIdx];
  const spellKey = state.spells[slotIdx];
  const spellInfo = SpellData.SPELLS[spellKey];

  if (spellInfo.cd === 0) return; // smite/mark - nao rastreia

  if (timer.active) {
    stopTimer(rowIdx, slotIdx);
  } else {
    startTimer(rowIdx, slotIdx);
  }
}

function startTimer(rowIdx, slotIdx) {
  const state = enemyState[rowIdx];
  const timer = state.timers[slotIdx];
  const spellInfo = SpellData.SPELLS[state.spells[slotIdx]];

  timer.remaining = Math.max(1, Math.floor(spellInfo.cd * cooldownModifier));
  timer.active = true;

  const btn = document.querySelector(
    `.spell-btn[data-row="${rowIdx}"][data-slot="${slotIdx}"]`
  );
  btn.classList.add('active');
  renderTimer(btn, timer.remaining);

  timer.intervalId = setInterval(() => {
    timer.remaining -= 1;
    if (timer.remaining <= 0) {
      stopTimer(rowIdx, slotIdx);
      return;
    }
    renderTimer(btn, timer.remaining);
  }, 1000);
}

function stopTimer(rowIdx, slotIdx) {
  const timer = enemyState[rowIdx].timers[slotIdx];
  if (timer.intervalId) clearInterval(timer.intervalId);
  timer.active = false;
  timer.remaining = 0;

  const btn = document.querySelector(
    `.spell-btn[data-row="${rowIdx}"][data-slot="${slotIdx}"]`
  );
  if (btn) {
    btn.classList.remove('active');
    const t = btn.querySelector('.timer');
    if (t) {
      t.textContent = '';
      t.classList.remove('warn');
    }
  }
}

function renderTimer(btn, remaining) {
  const span = btn.querySelector('.timer');
  if (!span) return;
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  span.textContent = `${m}:${String(s).padStart(2, '0')}`;
  span.classList.toggle('warn', remaining <= 30);
}

// =====================================================================
// Toolbar handlers
// =====================================================================

function resetAll() {
  enemyState.forEach((_, i) => {
    for (let j = 0; j < 2; j++) {
      if (enemyState[i].timers[j].active) stopTimer(i, j);
    }
  });
}

function toggleLucidity() {
  lucidityActive = !lucidityActive;
  cooldownModifier = lucidityActive ? 0.90 : 1.0;
  document.getElementById('lucid-btn').classList.toggle('active', lucidityActive);
}

function closeOverlay() {
  overwolf.windows.getCurrentWindow(result => {
    if (result.success) overwolf.windows.close(result.window.id);
  });
}

// =====================================================================
// Status header
// =====================================================================

function setStatus(text, mode) {
  document.getElementById('status-text').textContent = text;
  const dot = document.getElementById('status-dot');
  dot.classList.remove('live', 'idle');
  dot.classList.add(mode);
}

// =====================================================================
// Riot poller integration
// =====================================================================

function startPoller() {
  const poller = new LiveClientPoller();

  poller.addEventListener('game-started', () => {
    setStatus('AO VIVO', 'live');
    log('partida detectada');
  });

  poller.addEventListener('game-ended', () => {
    setStatus('AGUARDANDO', 'idle');
    resetAll();
    // Volta pros placeholders
    enemyState.forEach((_, i) => {
      const def = SpellData.DEFAULT_ENEMIES[i];
      enemyState[i].championId = null;
      enemyState[i].spellImageIds = [null, null];
      // Re-renderiza usando o default
      updateRowVisual(i, def);
    });
    log('partida acabou');
  });

  poller.addEventListener('roster-updated', e => {
    updateRoster(e.detail);
  });

  poller.start();
}

function updateRowVisual(i, enemy) {
  const row = document.querySelector(`.enemy-row[data-index="${i}"]`);
  if (!row) return;
  const ci = row.querySelector('.ci');
  ci.style.backgroundImage = '';
  ci.style.background = enemy.color;
  ci.textContent = enemy.letter;
  row.querySelector('.role').textContent = enemy.role;

  const spellBtns = row.querySelectorAll('.spell-btn');
  spellBtns.forEach((btn, j) => {
    const spellInfo = SpellData.SPELLS[enemy.spells[j]];
    btn.classList.add('no-icon');
    btn.classList.remove('has-icon');
    btn.style.backgroundImage = '';
    btn.style.backgroundColor = applyAlpha(spellInfo.color, 0.22);
    btn.textContent = spellInfo.letter;
    let t = btn.querySelector('.timer');
    if (!t) {
      t = document.createElement('span');
      t.className = 'timer';
      btn.appendChild(t);
    }
  });
}

// =====================================================================
// Hotkey listener (mensagens vindas do background)
// =====================================================================

function setupHotkeyListener() {
  if (typeof overwolf !== 'undefined' && overwolf.windows && overwolf.windows.onMessageReceived) {
    overwolf.windows.onMessageReceived.addListener(msg => {
      if (msg.id === 'reset-all') resetAll();
    });
  }
}

// =====================================================================
// Resize handle (drag no canto inferior direito)
// =====================================================================

function setupResize() {
  const grip = document.getElementById('resize-grip');
  let resizing = false;
  let startX, startY, startW, startH, windowId;

  grip.addEventListener('mousedown', e => {
    e.preventDefault();
    resizing = true;
    startX = e.screenX;
    startY = e.screenY;
    overwolf.windows.getCurrentWindow(result => {
      if (result.success) {
        startW = result.window.width;
        startH = result.window.height;
        windowId = result.window.id;
      }
    });
  });

  document.addEventListener('mousemove', e => {
    if (!resizing || !windowId) return;
    const dx = e.screenX - startX;
    const dy = e.screenY - startY;
    const newW = Math.max(180, startW + dx);
    const newH = Math.max(220, startH + dy);
    overwolf.windows.changeSize(windowId, newW, newH, () => {});
  });

  document.addEventListener('mouseup', () => {
    resizing = false;
  });
}

// =====================================================================
// Logging simples
// =====================================================================

function log(msg) {
  console.log(`[overlay] ${msg}`);
}

// =====================================================================
// Bootstrap
// =====================================================================

document.addEventListener('DOMContentLoaded', init);
