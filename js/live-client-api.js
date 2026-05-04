// =====================================================================
// Live Client API poller
// Faz polling em https://127.0.0.1:2999/liveclientdata/allgamedata
// Emite custom events quando o estado da partida muda.
// =====================================================================

const RIOT_API_URL = 'https://127.0.0.1:2999/liveclientdata/allgamedata';
const POLL_INTERVAL_MS = 3000;

class LiveClientPoller extends EventTarget {
  constructor() {
    super();
    this._timer = null;
    this._inGame = false;
    this._lastSignature = null;
  }

  start() {
    if (this._timer) return;
    this._poll();
    this._timer = setInterval(() => this._poll(), POLL_INTERVAL_MS);
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  async _poll() {
    let data = null;
    try {
      const resp = await fetch(RIOT_API_URL, {
        method: 'GET',
        cache: 'no-store',
        // Cert da Riot e self-signed mas Overwolf permite essa request
      });
      if (resp.ok) {
        data = await resp.json();
      }
    } catch (err) {
      // Fora de partida ou API indisponivel - silencioso
    }

    if (!data) {
      this._handleNoGame();
      return;
    }

    const enemies = this._extractEnemies(data);
    if (enemies === null) {
      this._handleNoGame();
      return;
    }

    if (!this._inGame) {
      this._inGame = true;
      this.dispatchEvent(new CustomEvent('game-started', { detail: enemies }));
    }

    const signature = enemies
      .map(e => `${e.championName}|${e.summonerName || e.riotIdGameName || ''}`)
      .join('::');
    if (signature !== this._lastSignature) {
      this._lastSignature = signature;
      this.dispatchEvent(new CustomEvent('roster-updated', { detail: enemies }));
    }
  }

  _extractEnemies(data) {
    const active = data.activePlayer || {};
    const activeName = active.summonerName || active.riotIdGameName || '';
    const allPlayers = data.allPlayers || [];
    if (!allPlayers.length) return null;

    let myTeam = null;
    for (const p of allPlayers) {
      const pName = p.summonerName || p.riotIdGameName || '';
      if (pName === activeName) {
        myTeam = p.team;
        break;
      }
    }
    if (!myTeam) myTeam = 'ORDER';

    return allPlayers.filter(p => p.team !== myTeam);
  }

  _handleNoGame() {
    if (this._inGame) {
      this._inGame = false;
      this._lastSignature = null;
      this.dispatchEvent(new CustomEvent('game-ended'));
    }
  }
}

window.LiveClientPoller = LiveClientPoller;
