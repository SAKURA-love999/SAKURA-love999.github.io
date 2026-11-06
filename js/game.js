(() => {
const gameCanvas = document.querySelector("#fleepy-game");
    const gameScore = document.querySelector("#fleepy-score");
    const gameStateText = document.querySelector("#fleepy-state");
    const gameButton = document.querySelector("#fleepy-start");
    if (!gameCanvas) return;
    const gameContext = gameCanvas.getContext("2d");
    const game = {
      running: false,
      over: false,
      score: 0,
      lastFrame: 0,
      player: { x: 136, y: 134, velocity: 0, radius: 15 },
      pipes: []
    };

    function newPipe(x) {
      return {
        x,
        gapY: 62 + Math.random() * 92,
        passed: false
      };
    }

    function resetGame() {
      game.running = false;
      game.over = false;
      game.score = 0;
      game.player.y = 134;
      game.player.velocity = 0;
      game.pipes = [newPipe(760)];
      gameScore.textContent = "0";
      gameStateText.textContent = "READY";
      gameButton.textContent = "START";
      drawGame();
    }

    function drawGame() {
      const width = gameCanvas.width;
      const height = gameCanvas.height;
      const groundY = height - 28;

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
        const gap = 106;
        const pipeWidth = 58;
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
      game.running = false;
      game.over = true;
      gameStateText.textContent = "GAME OVER";
      gameButton.textContent = "RETRY";
      drawGame();
    }

    function updateGame(delta) {
      const width = gameCanvas.width;
      const height = gameCanvas.height;
      const groundY = height - 28;
      const bird = game.player;
      const pipeWidth = 58;
      const gap = 106;

      bird.velocity += 0.36 * delta;
      bird.y += bird.velocity * delta;

      game.pipes.forEach((pipe) => {
        pipe.x -= 2.25 * delta;
        if (!pipe.passed && pipe.x + pipeWidth < bird.x) {
          pipe.passed = true;
          game.score += 1;
          gameScore.textContent = String(game.score);
        }
      });

      if (game.pipes[game.pipes.length - 1].x < width - 230) {
        game.pipes.push(newPipe(width + 40));
      }
      if (game.pipes[0].x < -90) {
        game.pipes.shift();
      }

      const hitPipe = game.pipes.some((pipe) => (
        bird.x + bird.radius > pipe.x &&
        bird.x - bird.radius < pipe.x + pipeWidth &&
        (bird.y - bird.radius < pipe.gapY || bird.y + bird.radius > pipe.gapY + gap)
      ));

      if (bird.y - bird.radius < 0 || bird.y + bird.radius > groundY || hitPipe) {
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
      game.player.velocity = -6.6;
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


})();
