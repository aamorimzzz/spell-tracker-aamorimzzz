const LOL_CLASS_ID = 5426;

function checkLolStatus() {
  overwolf.games.getRunningGameInfo(info => {
    const status = document.getElementById('lol-status');
    if (info && info.isRunning && Math.floor(info.id / 10) === LOL_CLASS_ID) {
      status.textContent = '✓ LoL está rodando — overlay deve aparecer ao entrar na partida';
      status.className = 'status-line live';
    } else {
      status.textContent = 'LoL não está aberto. Inicia o jogo pra ativar o overlay.';
      status.className = 'status-line idle';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  checkLolStatus();
  setInterval(checkLolStatus, 5000);
});
