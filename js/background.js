// =====================================================================
// Background controller
// Roda enquanto o app esta ativo. Detecta inicio/fim do LoL
// e abre/fecha a janela do overlay automaticamente.
// =====================================================================

const LOL_CLASS_ID = 5426;

function isLolRunning(gameInfo) {
  if (!gameInfo) return false;
  if (!gameInfo.isRunning) return false;
  // O classId vem como gameId * 10 + 0..9 (instances). Pra checar "e o LoL?"
  // dividimos por 10 e comparamos com o LOL_CLASS_ID
  const classId = Math.floor(gameInfo.id / 10);
  return classId === LOL_CLASS_ID;
}

async function openWindow(name) {
  return new Promise(resolve => {
    overwolf.windows.obtainDeclaredWindow(name, result => {
      if (!result.success) {
        console.error(`Falha ao obter window ${name}:`, result.error);
        resolve(null);
        return;
      }
      overwolf.windows.restore(result.window.id, () => resolve(result.window));
    });
  });
}

async function closeWindow(name) {
  overwolf.windows.obtainDeclaredWindow(name, result => {
    if (result.success) overwolf.windows.close(result.window.id);
  });
}

function onGameInfoUpdated(info) {
  const game = info && info.gameInfo;
  if (isLolRunning(game) && info.runningChanged) {
    console.log('[bg] LoL iniciou - abrindo overlay');
    openWindow('ingame');
  } else if (info.runningChanged && game && !game.isRunning) {
    console.log('[bg] LoL fechou - fechando overlay');
    closeWindow('ingame');
  }
}

function setupHotkeys() {
  // Hotkey de toggle da visibilidade
  overwolf.settings.hotkeys.onPressed.addListener(event => {
    console.log('[bg] hotkey pressionada:', event.name);
    if (event.name === 'spell_tracker_toggle') {
      overwolf.windows.obtainDeclaredWindow('ingame', res => {
        if (!res.success) return;
        const w = res.window;
        if (w.stateEx === 'minimized' || w.stateEx === 'hidden' || w.stateEx === 'closed') {
          overwolf.windows.restore(w.id);
        } else {
          overwolf.windows.hide(w.id);
        }
      });
    } else if (event.name === 'spell_tracker_reset') {
      // Notifica a janela ingame pra resetar timers
      overwolf.windows.sendMessage('ingame', 'reset-all', {}, () => {});
    }
  });
}

function setupAutoOpen() {
  // Abre o overlay quando o LoL ja esta rodando ao iniciar o app
  overwolf.games.getRunningGameInfo(info => {
    if (isLolRunning(info)) {
      console.log('[bg] LoL ja estava rodando - abrindo overlay');
      openWindow('ingame');
    } else {
      console.log('[bg] LoL nao esta rodando - aguardando');
    }
  });

  overwolf.games.onGameInfoUpdated.addListener(onGameInfoUpdated);
}

(function main() {
  console.log('[bg] Spell Tracker by aamorimzzz - background iniciado');
  setupHotkeys();
  setupAutoOpen();
})();
