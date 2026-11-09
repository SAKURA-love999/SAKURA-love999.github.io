(() => {
const gameCanvas = document.querySelector("#fleepy-game");
    const gameScore = document.querySelector("#fleepy-score");
    const gameStateText = document.querySelector("#fleepy-state");
    const gameButton = document.querySelector("#fleepy-start");
    if (!gameCanvas) return;
    const gameContext = gameCanvas.getContext("2d");
    const historyList = document.querySelector("#game-history-list");
    const historyMore = document.querySelector("#game-history-more");
    let storage;
    try { storage = window.localStorage; } catch {}
    const history = window.SakuraGameHistory.createStore(storage);
    let visibleRounds = 5;

    function renderHistory() {
      const chinese = document.documentElement.lang === "zh-CN";
      const rounds = history.rounds;
      const format = new Intl.DateTimeFormat(chinese ? "zh-CN" : "ja-JP", {
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
      });
      historyList.replaceChildren();
      rounds.slice(0, visibleRounds).forEach((round) => {
        const item = document.createElement("li");
        const time = document.createElement("time");
        time.dateTime = round.playedAt;
        time.textContent = format.format(new Date(round.playedAt));
        const score = document.createElement("span");
        score.className = "game-history__score";
        const value = document.createElement("strong");
        value.textContent = String(round.score);
        const unit = document.createElement("span");
        unit.textContent = chinese ? "分" : "点";
        score.append(value, unit);
        item.append(time, score);
        historyList.append(item);
      });
      document.querySelector("#game-history-count").textContent = String(rounds.length);
      document.querySelector("#game-history-empty").hidden = rounds.length > 0;
      document.querySelector("#game-history-warning").hidden = history.persistent;
      historyMore.hidden = visibleRounds >= rounds.length;
    }

    historyMore.addEventListener("click", () => {
      visibleRounds += 5;
      renderHistory();
    });
    document.addEventListener("sakura:languagechange", renderHistory);
    window.addEventListener("storage", (event) => {
      if (event.key === window.SakuraGameHistory.KEY || event.key === null) {
        history.reload();
        renderHistory();
      }
    });
    const settings = {
      gravity: 0.12,
      flapVelocity: -2.6,
      maxFallSpeed: 2.4,
      scrollSpeed: 1.6,
      pipeGap: 148,
      pipeWidth: 58,
      pipeSpacing: 340,
      groundHeight: 28
    };
    const startingY = (gameCanvas.height - settings.groundHeight) / 2;
    const game = {
      running: false,
      over: false,
      score: 0,
      lastFrame: 0,
      player: { x: 136, y: startingY, velocity: 0, radius: 15 },
      pipes: []
    };

    function newPipe(x) {
      const margin = 24;
      const travel = Math.max(0, gameCanvas.height - settings.groundHeight - settings.pipeGap - margin * 2);
      return {
        x,
        gapY: margin + Math.random() * travel,
        passed: false
      };
    }

    function resetGame() {
      game.running = false;
      game.over = false;
      game.score = 0;
      game.player.y = startingY;
      game.player.velocity = 0;
      game.pipes = [newPipe(gameCanvas.width + 40)];
      gameScore.textContent = "0";
      gameStateText.textContent = "READY";
      gameButton.textContent = "START";
      drawGame();
    }

    function drawGame() {
      const width = gameCanvas.width;
      const height = gameCanvas.height;
      const groundY = height - settings.groundHeight;

      gameContext.clearRect(0, 0, width, height);
      gameContext.fillStyle = "#dcecf2";
      gameContext.fillRect(0, 0, width, height);

      gameContext.fillStyle = "rgba(255, 255, 255, 0.72)";
      gameContext.beginPath();
      gameContext.arc(94, 62, 24, 0, Math.PI * 2);
      gameContext.arc(122, 58, 32, 0, Math.PI * 2);
      gameContext.arc(158, 64, 22, 0, Math.PI * 2);
      gameContext.fill();

      gameContext.fillStyle = "#526b5a";
      game.pipes.forEach((pipe) => {
        const gap = settings.pipeGap;
        const pipeWidth = settings.pipeWidth;
        gameContext.fillRect(pipe.x, 0, pipeWidth, pipe.gapY);
        gameContext.fillRect(pipe.x, pipe.gapY + gap, pipeWidth, groundY - pipe.gapY - gap);
        gameContext.fillStyle = "#3f5e50";
        gameContext.fillRect(pipe.x - 5, pipe.gapY - 10, pipeWidth + 10, 10);
        gameContext.fillRect(pipe.x - 5, pipe.gapY + gap, pipeWidth + 10, 10);
        gameContext.fillStyle = "#526b5a";
      });

      gameContext.fillStyle = "#e8d8b8";
      gameContext.fillRect(0, groundY, width, height - groundY);
      gameContext.fillStyle = "rgba(82, 107, 90, 0.24)";
      for (let x = 0; x < width; x += 28) {
        gameContext.fillRect(x, groundY + 7, 16, 2);
      }

      const bird = game.player;
      gameContext.save();
      gameContext.translate(bird.x, bird.y);
      gameContext.rotate(Math.max(-0.45, Math.min(0.55, bird.velocity / 14)));
      gameContext.fillStyle = "#b84f64";
      gameContext.beginPath();
      gameContext.arc(0, 0, bird.radius, 0, Math.PI * 2);
      gameContext.fill();
      gameContext.fillStyle = "#f4c4d1";
      gameContext.beginPath();
      gameContext.ellipse(-7, 3, 8, 5, -0.4, 0, Math.PI * 2);
      gameContext.fill();
      gameContext.fillStyle = "#20232a";
      gameContext.beginPath();
      gameContext.arc(5, -5, 2.4, 0, Math.PI * 2);
      gameContext.fill();
      gameContext.restore();
    }

    function endGame() {
      if (game.over) return;
      game.running = false;
      game.over = true;
      gameStateText.textContent = "GAME OVER";
      gameButton.textContent = "RETRY";
      history.add(game.score);
      visibleRounds = 5;
      renderHistory();
      drawGame();
    }

    function updateGame(delta) {
      const width = gameCanvas.width;
      const height = gameCanvas.height;
      const groundY = height - settings.groundHeight;
      const bird = game.player;
      const pipeWidth = settings.pipeWidth;
      const gap = settings.pipeGap;

      bird.velocity = Math.min(settings.maxFallSpeed, bird.velocity + settings.gravity * delta);
      bird.y += bird.velocity * delta;
      if (bird.y < bird.radius) {
        bird.y = bird.radius;
        bird.velocity = Math.max(0, bird.velocity);
      }

      game.pipes.forEach((pipe) => {
        pipe.x -= settings.scrollSpeed * delta;
        if (!pipe.passed && pipe.x + pipeWidth < bird.x) {
          pipe.passed = true;
          game.score += 1;
          gameScore.textContent = String(game.score);
        }
      });

      const lastPipe = game.pipes[game.pipes.length - 1];
      if (lastPipe.x < width + 40 - settings.pipeSpacing) {
        game.pipes.push(newPipe(lastPipe.x + settings.pipeSpacing));
      }
      if (game.pipes[0].x < -90) {
        game.pipes.shift();
      }

      const hitPipe = game.pipes.some((pipe) => (
        bird.x + bird.radius > pipe.x &&
        bird.x - bird.radius < pipe.x + pipeWidth &&
        (bird.y - bird.radius < pipe.gapY || bird.y + bird.radius > pipe.gapY + gap)
      ));

      if (bird.y + bird.radius > groundY || hitPipe) {
        endGame();
      }
    }

    function tickGame(timestamp) {
      if (!game.running) return;
      const delta = Math.min(2.1, (timestamp - game.lastFrame) / 16.67 || 1);
      game.lastFrame = timestamp;
      updateGame(delta);
      drawGame();
      if (game.running) requestAnimationFrame(tickGame);
    }

    function flapGame() {
      if (game.over) resetGame();
      if (!game.running) {
        game.running = true;
        gameStateText.textContent = "PLAY";
        gameButton.textContent = "FLAP";
        game.lastFrame = performance.now();
        requestAnimationFrame(tickGame);
      }
      game.player.velocity = settings.flapVelocity;
    }

    gameButton.addEventListener("click", flapGame);
    gameCanvas.addEventListener("pointerdown", () => { gameCanvas.focus({ preventScroll: true }); flapGame(); });
    gameCanvas.addEventListener("keydown", (event) => {
      if (event.code === "Space" && !event.repeat) {
        event.preventDefault();
        flapGame();
      }
    });
    resetGame();
    renderHistory();


})();
