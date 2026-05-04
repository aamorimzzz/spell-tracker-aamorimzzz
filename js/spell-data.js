// =====================================================================
// Spell data + helpers idioma-independentes
// Mesma logica que validamos no PyQt, agora em JS.
// =====================================================================

const SPELLS = {
  flash:   { cd: 300, color: '#dcb43c', letter: 'F', label: 'Flash' },
  tp:      { cd: 360, color: '#3c82dc', letter: 'T', label: 'Teleport' },
  ignite:  { cd: 180, color: '#dc5a32', letter: 'I', label: 'Ignite' },
  heal:    { cd: 240, color: '#50c882', letter: 'H', label: 'Heal' },
  exhaust: { cd: 240, color: '#a0a0a0', letter: 'E', label: 'Exhaust' },
  cleanse: { cd: 240, color: '#e8e8a0', letter: 'C', label: 'Cleanse' },
  barrier: { cd: 180, color: '#a0c8e8', letter: 'B', label: 'Barrier' },
  ghost:   { cd: 240, color: '#c8a0e8', letter: 'G', label: 'Ghost' },
  smite:   { cd: 0,   color: '#888888', letter: 'S', label: 'Smite' },
  mark:    { cd: 0,   color: '#888888', letter: 'M', label: 'Mark' },
};

// Mapeia raw IDs (idioma-independente) pros nossos keys.
// Eles sao extraidos do rawDisplayName que sempre vem em ingles padronizado:
// "GeneratedTip_SummonerSpell_SummonerFlash_DisplayName" -> "SummonerFlash"
const RAW_NAME_TO_KEY = {
  SummonerFlash: 'flash',
  SummonerTeleport: 'tp',
  SummonerDot: 'ignite',
  SummonerHeal: 'heal',
  SummonerExhaust: 'exhaust',
  SummonerBoost: 'cleanse',
  SummonerBarrier: 'barrier',
  SummonerHaste: 'ghost',
  SummonerSmite: 'smite',
  S5_SummonerSmiteDuel: 'smite',
  S5_SummonerSmitePlayerGanker: 'smite',
  S5_SummonerSmiteQuick: 'smite',
  SummonerSnowball: 'mark',
  SummonerSnowURFSnowball_Mark: 'mark',
};

// Imagem padrao pra cada key (nome do PNG no Data Dragon)
const KEY_TO_IMAGE_ID = {
  flash:   'SummonerFlash',
  tp:      'SummonerTeleport',
  ignite:  'SummonerDot',
  heal:    'SummonerHeal',
  exhaust: 'SummonerExhaust',
  cleanse: 'SummonerBoost',
  barrier: 'SummonerBarrier',
  ghost:   'SummonerHaste',
  smite:   'SummonerSmite',
  mark:    'SummonerSnowball',
};

// Posicoes
const ROLE_ORDER = { TOP: 0, JUNGLE: 1, MIDDLE: 2, BOTTOM: 3, UTILITY: 4 };
const ROLE_LABELS = {
  TOP: 'TOP', JUNGLE: 'JNG', MIDDLE: 'MID',
  BOTTOM: 'ADC', UTILITY: 'SUP', '': '?',
};
const ROLE_COLORS = {
  TOP:     '#6b8e23',
  JUNGLE:  '#8b6914',
  MIDDLE:  '#b03a6b',
  BOTTOM:  '#4682b4',
  UTILITY: '#2f5d4f',
  '':      '#5a5a5a',
};

const DEFAULT_ENEMIES = [
  { role: 'TOP', letter: '?', color: '#5a5a5a', spells: ['flash', 'tp'] },
  { role: 'JNG', letter: '?', color: '#5a5a5a', spells: ['flash', 'ignite'] },
  { role: 'MID', letter: '?', color: '#5a5a5a', spells: ['flash', 'ignite'] },
  { role: 'ADC', letter: '?', color: '#5a5a5a', spells: ['flash', 'heal'] },
  { role: 'SUP', letter: '?', color: '#5a5a5a', spells: ['flash', 'exhaust'] },
];

// =====================================================================
// Extracao do raw display name pra ID idioma-independente
// =====================================================================

function extractSpellId(rawDisplayName) {
  if (!rawDisplayName || !rawDisplayName.endsWith('_DisplayName')) return null;
  const base = rawDisplayName.slice(0, -'_DisplayName'.length);
  const parts = base.split('_');
  for (let i = parts.length - 1; i >= 0; i--) {
    const seg = parts[i];
    if (seg.startsWith('Summoner') && seg !== 'SummonerSpell') {
      if (i > 0 && parts[i - 1] === 'S5') return `S5_${seg}`;
      return seg;
    }
  }
  return null;
}

function extractChampionId(rawChampionName) {
  if (!rawChampionName) return null;
  const m = rawChampionName.match(/game_character_displayname_(\w+)/);
  return m ? m[1] : null;
}

function identifySpell(spellObj) {
  if (!spellObj) return { key: 'flash', imageId: 'SummonerFlash' };
  const raw = spellObj.rawDisplayName || '';
  const spellId = extractSpellId(raw);
  if (spellId) {
    const key = RAW_NAME_TO_KEY[spellId] || 'flash';
    const imageId = KEY_TO_IMAGE_ID[key] || (spellId.startsWith('Summoner') ? spellId : null);
    return { key, imageId };
  }
  return { key: 'flash', imageId: 'SummonerFlash' };
}

function getChampionLetter(name) {
  if (!name) return '?';
  const cleaned = name.replace(/'/g, '');
  const parts = cleaned.split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name[0].toUpperCase();
}

// =====================================================================
// Parsing dos inimigos vindos da Live Client API
// =====================================================================

function parseRiotEnemies(rawEnemies) {
  const hasPositions = rawEnemies.some(p => ROLE_ORDER.hasOwnProperty(p.position || ''));
  let sorted;
  if (hasPositions) {
    sorted = [...rawEnemies].sort((a, b) => {
      const posA = ROLE_ORDER[a.position] !== undefined ? ROLE_ORDER[a.position] : 99;
      const posB = ROLE_ORDER[b.position] !== undefined ? ROLE_ORDER[b.position] : 99;
      return posA - posB;
    });
  } else {
    sorted = [...rawEnemies];
  }

  const parsed = sorted.map(p => {
    const position = p.position || '';
    const roleLabel = ROLE_LABELS[position] || '?';
    const color = ROLE_COLORS[position] || '#5a5a5a';
    const champName = p.championName || '?';
    const letter = getChampionLetter(champName);

    const spells = p.summonerSpells || {};
    const s1 = identifySpell(spells.summonerSpellOne);
    const s2 = identifySpell(spells.summonerSpellTwo);
    const champId = extractChampionId(p.rawChampionName) || champName.replace(/[\s'.]/g, '');

    return {
      role: roleLabel,
      letter,
      color,
      spells: [s1.key, s2.key],
      spellImageIds: [s1.imageId, s2.imageId],
      champion: champName,
      championId: champId,
    };
  });

  while (parsed.length < 5) parsed.push(DEFAULT_ENEMIES[parsed.length]);
  return parsed.slice(0, 5);
}

// Exporta pro escopo global (Overwolf usa scripts simples, sem modules ES6)
window.SpellData = {
  SPELLS,
  DEFAULT_ENEMIES,
  parseRiotEnemies,
  identifySpell,
  extractSpellId,
  extractChampionId,
  getChampionLetter,
};
