// =====================================================================
// Spell Tracker - logica do overlay v0.2 (com animacoes)
// =====================================================================

const DDRAGON_BASE = 'https://ddragon.leagueoflegends.com';
let DDRAGON_VERSION = '14.21.1';

// Threshold do progress ring (0-100%)
// Circumference = 2 * Math.PI * 16 = ~100.53, simplificamos pra 100
const RING_CIRCUMFERENCE = 100;

let cooldownModifier = 1.0;
let lucidityActive = false;
const enemyState = [];

// =====================================================================
// Init
// =====================================================================

async function init() {
  await loadDDragonVersion();
  buildUI();
  setupHotkeyListener();
  setupResize();
  startPoller();
  log('overlay v0.2 iniciado');
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
// Build UI
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
      const btn = createSpellButton(i, j, enemy.spells[j]);
      row.appendChild(btn);
    }

    container.appendChild(row);

    enemyState.push({
      ...enemy,
      championId: null,
      spellImageIds: [null, null],
      timers: [
        { remaining: 0, totalCd: 0, active: false, intervalId: null },
        { remaining: 0, totalCd: 0, active: false, intervalId: null },
      ],
    });
  }

  document.getElementById('reset-btn').addEventListener('click', resetAll);
  document.getElementById('lucid-btn').addEventListener('click', toggleLucidity);
  document.getElementById('close-btn').addEventListener('click', closeOverlay);
}

function createSpellButton(rowIdx, slotIdx, spellKey) {
  const btn = document.createElement('button');
  btn.className = 'spell-btn no-icon';
  btn.dataset.row = rowIdx;
  btn.dataset.slot = slotIdx;
  btn.dataset.spellKey = spellKey;

  const spellInfo = SpellData.SPELLS[spellKey];

  // Spell icon (background)
  const icon = document.createElement('span');
  icon.className = 'spell-icon';
  icon.style.backgroundColor = applyAlpha(spellInfo.color, 0.22);
  icon.textContent = spellInfo.letter;
  btn.appendChild(icon);

  // SVG ring (progress) - usa o symbol declarado no HTML
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('ring');
  svg.setAttribute('viewBox', '0 0 36 36');
  svg.innerHTML = `
    <circle class="ring-track" cx="18" cy="18" r="16" fill="none" stroke-width="2"/>
    <circle class="ring-progress" cx="18" cy="18" r="16" fill="none" stroke-width="2"
            stroke-linecap="round" transform="rotate(-90 18 18)"/>
  `;
  btn.appendChild(svg);

  // Timer label
  const timerSpan = document.createElement('span');
  timerSpan.className = 'timer';
  btn.appendChild(timerSpan);

  // Click handlers
  btn.addEventListener('click', (e) => {
    createRipple(e, btn);
    onSpellClick(rowIdx, slotIdx);
  });

  return btn;
}

function applyAlpha(hexColor, alpha) {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// =====================================================================
// Ripple effect on click
// =====================================================================

function createRipple(event, btn) {
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;

  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.cssText = `
    width: ${size}px; height: ${size}px;
    left: ${x}px; top: ${y}px;
  `;
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 500);
}

// =====================================================================
// Update roster
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

    // Champion icon - pop animation quando carrega
    const ci = row.querySelector('.ci');
    if (enemy.championId) {
      const url = championIconUrl(enemy.championId);
      ci.style.backgroundImage = `url('${url}')`;
      ci.style.backgroundColor = enemy.color;
      ci.classList.add('has-icon', 'loaded');
      ci.textContent = '';
      // Remove classe loaded depois da animação pra poder repetir
      setTimeout(() => ci.classList.remove('loaded'), 400);
    } else {
      ci.style.background = enemy.color;
      ci.classList.remove('has-icon');
      ci.textContent = enemy.letter;
    }

    row.querySelector('.role').textContent = enemy.role;

    // Update spell buttons
    const spellBtns = row.querySelectorAll('.spell-btn');
    spellBtns.forEach((btn, j) => {
      const spellKey = enemy.spells[j];
      const imageId = state.spellImageIds[j];
      const spellInfo = SpellData.SPELLS[spellKey];

      // Reseta timer
      const timer = state.timers[j];
      if (timer.active) {
        clearInterval(timer.intervalId);
        timer.active = false;
        timer.remaining = 0;
        btn.classList.remove('active', 'warn', 'danger');
      }

      btn.dataset.spellKey = spellKey;
      const icon = btn.querySelector('.spell-icon');
      const url = spellIconUrl(imageId);

      if (url) {
        icon.style.backgroundImage = `url('${url}')`;
        icon.style.backgroundColor = '';
        icon.textContent = '';
      } else {
        icon.style.backgroundImage = '';
        icon.style.backgroundColor = applyAlpha(spellInfo.color, 0.22);
        icon.textContent = spellInfo.letter;
      }
    });
  });

  log('roster: ' + parsed.map(e => e.champion).join(', '));
}

// =====================================================================
// Spell timer logic
// =====================================================================

function onSpellClick(rowIdx, slotIdx) {
  const state = enemyState[rowIdx];
  const timer = state.timers[slotIdx];
  const spellKey = state.spells[slotIdx];
  const spellInfo = SpellData.SPELLS[spellKey];

  if (spellInfo.cd === 0) return; // smite/mark

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

  const totalCd = Math.max(1, Math.floor(spellInfo.cd * cooldownModifier));
  timer.totalCd = totalCd;
  timer.remaining = totalCd;
  timer.active = true;

  const btn = getSpellBtn(rowIdx, slotIdx);
  btn.classList.add('active');
  updateTimerVisual(btn, timer);

  timer.intervalId = setInterval(() => {
    timer.remaining -= 1;
    if (timer.remaining <= 0) {
      stopTimer(rowIdx, slotIdx, true);
      return;
    }
    updateTimerVisual(btn, timer);
  }, 1000);
}

function stopTimer(rowIdx, slotIdx, completed = false) {
  const timer = enemyState[rowIdx].timers[slotIdx];
  if (timer.intervalId) clearInterval(timer.intervalId);
  timer.active = false;
  timer.remaining = 0;
  timer.totalCd = 0;

  const btn = getSpellBtn(rowIdx, slotIdx);
  if (!btn) return;

  btn.classList.remove('active', 'warn', 'danger');
  const t = btn.querySelector('.timer');
  if (t) t.textContent = '';

  // Reseta o anel
  const ringProgress = btn.querySelector('.ring-progress');
  if (ringProgress) ringProgress.style.strokeDashoffset = '0';

  // Flash de "pronto" quando o timer chega ao fim naturalmente
  if (completed) {
    btn.classList.add('ready-flash');
    setTimeout(() => btn.classList.remove('ready-flash'), 600);
  }
}

function updateTimerVisual(btn, timer) {
  // Atualiza texto do timer
  const m = Math.floor(timer.remaining / 60);
  const s = timer.remaining % 60;
  const t = btn.querySelector('.timer');
  if (t) t.textContent = `${m}:${String(s).padStart(2, '0')}`;

  // Atualiza progress ring (vai diminuindo conforme passa)
  const ringProgress = btn.querySelector('.ring-progress');
  if (ringProgress && timer.totalCd > 0) {
    const progress = timer.remaining / timer.totalCd;
    const offset = RING_CIRCUMFERENCE * (1 - progress);
    ringProgress.style.strokeDashoffset = offset;
  }

  // Aplica classes de cor conforme tempo restante
  btn.classList.remove('warn', 'danger');
  if (timer.remaining <= 10) {
    btn.classList.add('danger');
  } else if (timer.remaining <= 30) {
    btn.classList.add('warn');
  }
}

function getSpellBtn(rowIdx, slotIdx) {
  return document.querySelector(`.spell-btn[data-row="${rowIdx}"][data-slot="${slotIdx}"]`);
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
  if (typeof overwolf !== 'undefined' && overwolf.windows) {
    overwolf.windows.getCurrentWindow(result => {
      if (result.success) overwolf.windows.close(result.window.id);
    });
  } else {
    window.close();
  }
}

// =====================================================================
// Status header
// =====================================================================

function setStatus(text, mode) {
  document.querySelector('.status-text').textContent = text;
  const overlay = document.getElementById('overlay');
  overlay.classList.remove('state-idle', 'state-live');
  overlay.classList.add(mode === 'live' ? 'state-live' : 'state-idle');
}

// =====================================================================
// Riot poller
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
    enemyState.forEach((_, i) => {
      const def = SpellData.DEFAULT_ENEMIES[i];
      enemyState[i].championId = null;
      enemyState[i].spellImageIds = [null, null];
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
  ci.classList.remove('has-icon');
  ci.textContent = enemy.letter;
  row.querySelector('.role').textContent = enemy.role;

  const spellBtns = row.querySelectorAll('.spell-btn');
  spellBtns.forEach((btn, j) => {
    const spellInfo = SpellData.SPELLS[enemy.spells[j]];
    const icon = btn.querySelector('.spell-icon');
    icon.style.backgroundImage = '';
    icon.style.backgroundColor = applyAlpha(spellInfo.color, 0.22);
    icon.textContent = spellInfo.letter;
  });
}

// =====================================================================
// Hotkey listener (mensagens do background)
// =====================================================================

function setupHotkeyListener() {
  if (typeof overwolf !== 'undefined' && overwolf.windows && overwolf.windows.onMessageReceived) {
    overwolf.windows.onMessageReceived.addListener(msg => {
      if (msg.id === 'reset-all') resetAll();
    });
  }
}

// =====================================================================
// Resize handle
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
    if (typeof overwolf !== 'undefined' && overwolf.windows) {
      overwolf.windows.getCurrentWindow(result => {
        if (result.success) {
          startW = result.window.width;
          startH = result.window.height;
          windowId = result.window.id;
        }
      });
    }
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

function log(msg) {
  console.log(`[overlay] ${msg}`);
}

document.addEventListener('DOMContentLoaded', init);
