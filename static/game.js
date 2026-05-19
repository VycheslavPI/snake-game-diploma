const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreText = document.getElementById("score");
const levelText = document.getElementById("level");
const foodValueText = document.getElementById("foodValue");
const gameOverText = document.getElementById("gameOver");
const winText = document.getElementById("winText");
const bestScoreText = document.getElementById("bestScore");
const activeEffectText = document.getElementById("activeEffect");
const foodTypeText = document.getElementById("foodType");
const resultPanel = document.getElementById("resultPanel");
const resultTitle = document.getElementById("resultTitle");
const resultScore = document.getElementById("resultScore");
const resultCoins = document.getElementById("resultCoins");
const resultBest = document.getElementById("resultBest");
const resultLevel = document.getElementById("resultLevel");
const resultAchievements = document.getElementById("resultAchievements");
const gameOverlay = document.getElementById("gameOverlay");
const levelComplete = document.getElementById("levelComplete");
const levelCompleteText = document.getElementById("levelCompleteText");
const pauseText = document.getElementById("pauseText");
const pauseBtn = document.getElementById("pauseBtn");
const soundBtn = document.getElementById("soundBtn");
const effectsBtn = document.getElementById("effectsBtn");

const skinHead = window.GAME_CONFIG.skin.head;
const skinBody1 = window.GAME_CONFIG.skin.body1;
const skinBody2 = window.GAME_CONFIG.skin.body2;

const trailColor1 = window.GAME_CONFIG.trail.color1;
const trailColor2 = window.GAME_CONFIG.trail.color2;
const trailName = window.GAME_CONFIG.trail.name;

const gridSize = 20;
const tileCount = canvas.width / gridSize;
const finalLevel = 10;

const maps = [
    { bg: "#04122b", grid: "rgba(0,255,150,0.08)", obstacle: "#00ccff", name: "NEON GRID", wallStyle: "neon" },
    { bg: "#06281b", grid: "rgba(0,255,120,0.08)", obstacle: "#00ff66", name: "TOXIC START", wallStyle: "toxic" },
    { bg: "#0a331f", grid: "rgba(50,255,120,0.08)", obstacle: "#22c55e", name: "TOXIC MAZE", wallStyle: "toxic" },
    { bg: "#071a2f", grid: "rgba(100,200,255,0.08)", obstacle: "#38bdf8", name: "ICE CORE", wallStyle: "ice" },
    { bg: "#0c233f", grid: "rgba(180,240,255,0.08)", obstacle: "#7dd3fc", name: "FROZEN WALLS", wallStyle: "ice" },
    { bg: "#220a38", grid: "rgba(200,100,255,0.08)", obstacle: "#c026d3", name: "VOID GATE", wallStyle: "void" },
    { bg: "#160523", grid: "rgba(180,50,255,0.08)", obstacle: "#9333ea", name: "VOID MAZE", wallStyle: "void" },
    { bg: "#3b1204", grid: "rgba(255,120,0,0.08)", obstacle: "#ff6600", name: "INFERNO", wallStyle: "fire" },
    { bg: "#2a0700", grid: "rgba(255,80,0,0.08)", obstacle: "#ff3300", name: "FINAL FIREWALL", wallStyle: "fire" },
    { bg: "#000000", grid: "rgba(255,0,0,0.08)", obstacle: "#ff0033", name: "CORE ESCAPE", wallStyle: "final" }
];

const foodTypes = [
    { id: "normal", name: "Обычная", color: "#ff3355", glow: "#ff3355", chance: 55 },
    { id: "slow", name: "Замедление", color: "#38bdf8", glow: "#38bdf8", chance: 15 },
    { id: "gold", name: "Золотая x3", color: "#facc15", glow: "#facc15", chance: 12 },
    { id: "coin", name: "Монетная", color: "#22c55e", glow: "#22c55e", chance: 10 },
    { id: "ghost", name: "Призрак", color: "#a855f7", glow: "#a855f7", chance: 8 }
];

let snake = [];
let previousSnake = [];

let food = {};
let currentFoodType = foodTypes[0];

let obstacles = [];
let particles = [];
let trailParticles = [];

let miniBossMode = false;
let miniBossCompleted = false;
let miniBossTimer = 12;
let miniBossLasers = [];
let miniBossPulse = 0;
let miniBossInterval = null;

let dx = 1;
let dy = 0;
let nextDx = 1;
let nextDy = 0;

let score = 0;
let bestScore = parseInt(bestScoreText.innerText) || 0;

let foodValue = 1;
let level = 1;
let eatenFood = 0;

let baseSpeed = 145;
let speed = baseSpeed;

let gameLoop = null;
let animationFrame = null;
let gameStarted = false;
let gamePaused = false;
let lastMoveTime = performance.now();

let levelTextAnimation = 0;
let slowTimer = 0;
let ghostCharges = 0;
let effectTimerInterval = null;
let audioContext = null;
let musicTimer = null;
let musicStep = 0;
let levelCompleteTimer = null;
let soundEnabled = localStorage.getItem("neonSnakeSound") !== "off";
let effectsQuality = localStorage.getItem("neonSnakeEffects") || "high";

gameOverText.style.display = "none";
winText.style.display = "none";
updateSettingsButtons();

document.getElementById("startBtn").addEventListener("click", startGame);
pauseBtn.addEventListener("click", togglePause);
soundBtn.addEventListener("click", toggleSound);
effectsBtn.addEventListener("click", toggleEffectsQuality);

function startGame() {
    snake = [{x: 10, y: 10}];
    previousSnake = snake.map(part => ({...part}));

    food = {};
    obstacles = [];
    particles = [];
    trailParticles = [];
    miniBossLasers = [];

    dx = 1;
    dy = 0;
    nextDx = 1;
    nextDy = 0;

    score = 0;
    level = 1;
    eatenFood = 0;
    foodValue = 1;

    baseSpeed = 145;
    speed = baseSpeed;

    slowTimer = 0;
    ghostCharges = 0;
    levelTextAnimation = 0;

    miniBossMode = false;
    miniBossCompleted = false;
    miniBossTimer = 12;
    miniBossPulse = 0;

    if (miniBossInterval) clearInterval(miniBossInterval);
    if (gameLoop) clearInterval(gameLoop);
    if (effectTimerInterval) clearInterval(effectTimerInterval);
    if (animationFrame) cancelAnimationFrame(animationFrame);
    stopMusic();
    hideLevelComplete();

    gameStarted = true;
    gamePaused = false;
    lastMoveTime = performance.now();

    scoreText.innerText = score;
    levelText.innerText = level;
    foodValueText.innerText = foodValue;
    activeEffectText.innerText = "Нет";
    foodTypeText.innerText = "Обычная";

    gameOverText.style.display = "none";
    winText.style.display = "none";
    resultPanel.hidden = true;
    gameOverlay.hidden = true;
    levelComplete.hidden = true;
    pauseText.hidden = true;
    updateSettingsButtons();

    obstacles = generateSafeObstacles(level);
    generateFood();

    gameLoop = setInterval(updateGameLogic, speed);
    effectTimerInterval = setInterval(updateEffectTimers, 1000);
    startMusic();

    renderLoop();
}

function getCurrentMap() {
    return maps[Math.min(level - 1, maps.length - 1)];
}

function updateGameLogic() {
    if (!gameStarted || gamePaused) return;

    previousSnake = snake.map(part => ({...part}));

    dx = nextDx;
    dy = nextDy;

    moveSnake();

    lastMoveTime = performance.now();

    if (checkCollision()) {
        endGame();
    }
}

function renderLoop() {
    drawScene();

    if (gameStarted) {
        animationFrame = requestAnimationFrame(renderLoop);
    }
}

function getSmoothProgress() {
    if (!gameStarted || gamePaused) return 1;

    const rawProgress = (performance.now() - lastMoveTime) / speed;
    const progress = Math.min(rawProgress, 1);

    return progress * progress * (3 - 2 * progress);
}

function getInterpolatedSnake() {
    if (!snake.length) return [];

    const progress = getSmoothProgress();

    return snake.map((part, index) => {
        const previous =
            previousSnake[index] ||
            previousSnake[previousSnake.length - 1] ||
            part;

        return {
            x: previous.x + (part.x - previous.x) * progress,
            y: previous.y + (part.y - previous.y) * progress
        };
    });
}

function drawScene() {
    drawBackground();
    drawTrail();
    drawObstacles();
    drawFood();
    drawSnake();
    drawMiniBoss();
    drawParticles();
    drawLevelHud();
    drawGhostHud();
}

function drawBackground() {
    const currentMap = getCurrentMap();

    ctx.fillStyle = currentMap.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = currentMap.grid;

    for (let i = 0; i <= canvas.width; i += gridSize) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
    }

    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "left";
    ctx.shadowBlur = 12;
    ctx.shadowColor = currentMap.obstacle;
    ctx.fillText(currentMap.name, 14, 26);
    ctx.restore();
}

function moveSnake() {
    if (!gameStarted || !snake.length) return;

    const oldHead = snake[0];

    if (trailName !== "No Trail") {
        createTrailParticle(
            oldHead.x * gridSize + gridSize / 2,
            oldHead.y * gridSize + gridSize / 2
        );
    }

    const head = {
        x: oldHead.x + dx,
        y: oldHead.y + dy
    };

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
        applyFoodEffect(currentFoodType);

        eatenFood++;

        playTone("eat");

        createParticles(
            food.x * gridSize + gridSize / 2,
            food.y * gridSize + gridSize / 2,
            currentFoodType.color
        );

        if (score > bestScore) {
            bestScore = score;
            bestScoreText.innerText = bestScore;
        }

        updateLevel();

        scoreText.innerText = score;
        foodValueText.innerText = foodValue;

        generateFood();
    } else {
        snake.pop();
    }
}

function applyFoodEffect(type) {
    if (type.id === "normal") {
        score += foodValue;
        activeEffectText.innerText = ghostCharges > 0 ? "Призрак x" + ghostCharges : "Нет";
    }

    if (type.id === "slow") {
        score += foodValue;
        slowTimer = 5;
        applySpeed();
        activeEffectText.innerText = "Замедление 5с";
    }

    if (type.id === "gold") {
        score += foodValue * 3;
        activeEffectText.innerText = "x3 очки";
    }

    if (type.id === "coin") {
        score += foodValue + 10;
        activeEffectText.innerText = "+10 бонус";
    }

    if (type.id === "ghost") {
        score += foodValue;
        ghostCharges += 1;
        activeEffectText.innerText = "Призрак x" + ghostCharges;
    }
}

function updateEffectTimers() {
    if (!gameStarted || gamePaused) return;

    if (slowTimer > 0) {
        slowTimer--;
        activeEffectText.innerText = "Замедление " + slowTimer + "с";

        if (slowTimer <= 0) {
            applySpeed();
            activeEffectText.innerText = ghostCharges > 0 ? "Призрак x" + ghostCharges : "Нет";
        }
    }
}

function applySpeed() {
    if (gameLoop) clearInterval(gameLoop);

    speed = slowTimer > 0 ? baseSpeed + 55 : baseSpeed;
    lastMoveTime = performance.now();

    gameLoop = setInterval(updateGameLogic, speed);
}

function updateLevel() {
    const newLevel = Math.floor(eatenFood / 5) + 1;

    if (newLevel > level) {
        level = newLevel;
        levelText.innerText = level;

        foodValue = Math.pow(2, level - 1);
        foodValueText.innerText = foodValue;

        baseSpeed = Math.max(65, baseSpeed - 8);

        obstacles = generateSafeObstacles(level);
        levelTextAnimation = 45;

        createParticles(200, 200, getCurrentMap().obstacle);
        playTone("level");
        showLevelComplete(level);
        restartMusic();

        if (level === 3 && !miniBossCompleted) {
            startMiniBoss();
        }

        applySpeed();
    }

    if (level >= finalLevel) {
        winGame();
    }
}
function startMiniBoss() {
    miniBossMode = true;
    miniBossCompleted = true;
    miniBossTimer = 12;
    miniBossLasers = [];

    activeEffectText.innerText = "⚠ MINI BOSS ⚠";
    playTone("boss");
    restartMusic();

    spawnMiniBossLasers();

    if (miniBossInterval) clearInterval(miniBossInterval);

    miniBossInterval = setInterval(() => {
        if (!miniBossMode || !gameStarted) {
            clearInterval(miniBossInterval);
            return;
        }

        miniBossTimer--;

        if (miniBossTimer <= 0) {
            miniBossMode = false;
            miniBossLasers = [];
            activeEffectText.innerText = ghostCharges > 0 ? "Призрак x" + ghostCharges : "Нет";
            createParticles(200, 200, "#00ffcc");
            clearInterval(miniBossInterval);
            return;
        }

        spawnMiniBossLasers();
    }, 1000);
}

function spawnMiniBossLasers() {
    miniBossLasers = [];

    const pattern = Math.random() > 0.5 ? "horizontal" : "vertical";

    if (pattern === "horizontal") {
        let row = Math.floor(Math.random() * tileCount);

        while (snake.length && Math.abs(row - snake[0].y) <= 1) {
            row = Math.floor(Math.random() * tileCount);
        }

        for (let x = 0; x < tileCount; x++) {
            miniBossLasers.push({
                x: x,
                y: row,
                warning: true,
                active: false
            });
        }
    }

    if (pattern === "vertical") {
        let col = Math.floor(Math.random() * tileCount);

        while (snake.length && Math.abs(col - snake[0].x) <= 1) {
            col = Math.floor(Math.random() * tileCount);
        }

        for (let y = 0; y < tileCount; y++) {
            miniBossLasers.push({
                x: col,
                y: y,
                warning: true,
                active: false
            });
        }
    }

    setTimeout(() => {
        miniBossLasers.forEach(laser => {
            laser.warning = false;
            laser.active = true;
        });
    }, 650);
}

function drawMiniBoss() {
    if (!miniBossMode) return;

    miniBossPulse += 0.08;

    ctx.save();

    ctx.fillStyle = "rgba(255, 0, 90, 0.08)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.shadowColor = "#ff0055";
    ctx.shadowBlur = 30;
    ctx.fillStyle = "#ff0055";

    ctx.beginPath();
    ctx.arc(
        canvas.width / 2,
        45,
        22 + Math.sin(miniBossPulse) * 4,
        0,
        Math.PI * 2
    );
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px Arial";
    ctx.textAlign = "center";
    ctx.fillText("MINI BOSS " + miniBossTimer, canvas.width / 2, 85);

    ctx.restore();

    drawMiniBossLasers();
}

function drawMiniBossLasers() {
    miniBossLasers.forEach(laser => {
        ctx.save();

        if (laser.warning) {
            ctx.fillStyle = "rgba(255,255,255,0.22)";
            ctx.shadowColor = "#ffffff";
            ctx.shadowBlur = 10;
        } else {
            ctx.fillStyle = "#ff0033";
            ctx.shadowColor = "#ff0033";
            ctx.shadowBlur = 22;
        }

        ctx.globalAlpha = laser.warning
            ? 0.35 + Math.sin(miniBossPulse * 10) * 0.2
            : 0.7 + Math.sin(miniBossPulse * 5) * 0.25;

        ctx.fillRect(
            laser.x * gridSize,
            laser.y * gridSize,
            gridSize,
            gridSize
        );

        ctx.restore();
    });
}

function getObstaclePattern(currentLevel) {
    let list = [];

    if (currentLevel >= 2) {
        for (let y = 4; y <= 8; y++) list.push({x: 5, y});
    }

    if (currentLevel >= 3) {
        for (let x = 11; x <= 16; x++) list.push({x, y: 5});
    }

    if (currentLevel >= 4) {
        for (let y = 11; y <= 16; y++) list.push({x: 14, y});
    }

    if (currentLevel >= 5) {
        for (let x = 3; x <= 8; x++) list.push({x, y: 14});
        for (let y = 3; y <= 7; y++) list.push({x: 17, y});
    }

    if (currentLevel >= 6) {
        for (let x = 7; x <= 12; x++) list.push({x, y: 9});
        for (let y = 10; y <= 14; y++) list.push({x: 9, y});
    }

    if (currentLevel >= 7) {
        for (let x = 2; x <= 6; x++) list.push({x, y: 3});
        for (let x = 13; x <= 17; x++) list.push({x, y: 16});
    }

    if (currentLevel >= 8) {
        for (let y = 6; y <= 13; y++) {
            if (y !== 10) list.push({x: 10, y});
        }
    }

    if (currentLevel >= 9) {
        for (let x = 4; x <= 15; x++) {
            if (x !== 9 && x !== 10) list.push({x, y: 11});
        }

        for (let y = 4; y <= 15; y++) {
            if (y !== 9 && y !== 10) list.push({x: 7, y});
        }
    }

    return list;
}

function generateSafeObstacles(currentLevel) {
    const pattern = getObstaclePattern(currentLevel);
    const head = snake[0];

    return pattern.filter(block => {
        if (isSnakeCell(block.x, block.y)) return false;
        if (food && block.x === food.x && block.y === food.y) return false;

        const distanceToHead =
            Math.abs(block.x - head.x) +
            Math.abs(block.y - head.y);

        if (distanceToHead <= 4) return false;

        const nextCells = [
            {x: head.x + dx, y: head.y + dy},
            {x: head.x + dx * 2, y: head.y + dy * 2},
            {x: head.x + dx * 3, y: head.y + dy * 3}
        ];

        for (let cell of nextCells) {
            if (block.x === cell.x && block.y === cell.y) return false;
        }

        return true;
    });
}

function chooseFoodType() {
    let totalChance = foodTypes.reduce((sum, type) => sum + type.chance, 0);
    let random = Math.random() * totalChance;

    for (let type of foodTypes) {
        if (random < type.chance) return type;
        random -= type.chance;
    }

    return foodTypes[0];
}

function generateFood() {
    let valid = false;
    let attempts = 0;

    currentFoodType = chooseFoodType();
    foodTypeText.innerText = currentFoodType.name;

    while (!valid && attempts < 500) {
        attempts++;

        food = {
            x: Math.floor(Math.random() * tileCount),
            y: Math.floor(Math.random() * tileCount)
        };

        valid = true;

        if (isSnakeCell(food.x, food.y)) valid = false;
        if (isObstacleCell(food.x, food.y)) valid = false;

        if (miniBossMode) {
            for (let laser of miniBossLasers) {
                if (laser.x === food.x && laser.y === food.y) {
                    valid = false;
                    break;
                }
            }
        }
    }

    if (!valid) {
        food = {x: 1, y: 1};
    }
}

function drawFood() {
    if (food.x === undefined || food.y === undefined) return;

    ctx.fillStyle = currentFoodType.color;
    ctx.shadowColor = currentFoodType.glow;
    ctx.shadowBlur = 20;

    ctx.beginPath();
    ctx.arc(
        food.x * gridSize + 10,
        food.y * gridSize + 10,
        8,
        0,
        Math.PI * 2
    );
    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.save();

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "center";

    let symbol = "●";

    if (currentFoodType.id === "slow") symbol = "S";
    if (currentFoodType.id === "gold") symbol = "x3";
    if (currentFoodType.id === "coin") symbol = "$";
    if (currentFoodType.id === "ghost") symbol = "G";

    ctx.fillText(
        symbol,
        food.x * gridSize + 10,
        food.y * gridSize + 14
    );

    ctx.restore();
}

function drawObstacles() {
    const currentMap = getCurrentMap();

    obstacles.forEach(block => {
        const x = block.x * gridSize + 2;
        const y = block.y * gridSize + 2;

        ctx.save();

        if (currentMap.wallStyle === "neon") {
            ctx.fillStyle = "#00ccff";
            ctx.shadowColor = "#00ccff";
        }

        if (currentMap.wallStyle === "toxic") {
            ctx.fillStyle = "#22c55e";
            ctx.shadowColor = "#22c55e";
        }

        if (currentMap.wallStyle === "ice") {
            ctx.fillStyle = "#7dd3fc";
            ctx.shadowColor = "#7dd3fc";
        }

        if (currentMap.wallStyle === "void") {
            ctx.fillStyle = "#c026d3";
            ctx.shadowColor = "#c026d3";
        }

        if (currentMap.wallStyle === "fire") {
            ctx.fillStyle = "#ff5500";
            ctx.shadowColor = "#ff5500";
        }

        if (currentMap.wallStyle === "final") {
            ctx.fillStyle = "#ff0033";
            ctx.shadowColor = "#ff0033";
        }

        ctx.shadowBlur = 18;

        if (currentMap.wallStyle === "fire") {
            ctx.beginPath();
            ctx.moveTo(x + 8, y);
            ctx.lineTo(x + 16, y + 8);
            ctx.lineTo(x + 8, y + 16);
            ctx.lineTo(x, y + 8);
            ctx.closePath();
            ctx.fill();
        } else if (currentMap.wallStyle === "void") {
            ctx.beginPath();
            ctx.arc(x + 8, y + 8, 8, 0, Math.PI * 2);
            ctx.fill();
        } else if (currentMap.wallStyle === "final") {
            ctx.fillRect(x, y, gridSize - 4, gridSize - 4);
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, gridSize - 4, gridSize - 4);
        } else {
            drawRoundedRect(x, y, gridSize - 4, gridSize - 4, currentMap.wallStyle === "ice" ? 2 : 5);
        }

        ctx.restore();
    });
}
function createTrailParticle(x, y) {
    if (effectsQuality === "low") return;

    let color = Math.random() > 0.5 ? trailColor1 : trailColor2;

    if (trailName === "Rainbow Trail") {
        const rainbow = ["#ff0055", "#ffaa00", "#00ff99", "#00ccff", "#aa00ff"];
        color = rainbow[Math.floor(Math.random() * rainbow.length)];
    }

    let particleCount = 2;

    if (trailName === "Fire Trail") particleCount = 4;
    if (trailName === "Void Trail") particleCount = 5;
    if (trailName === "Rainbow Trail") particleCount = 4;

    for (let i = 0; i < particleCount; i++) {
        trailParticles.push({
            x: x + (Math.random() - 0.5) * 12,
            y: y + (Math.random() - 0.5) * 12,
            dx: (Math.random() - 0.5) * 1.8,
            dy: (Math.random() - 0.5) * 1.8,
            size:
                trailName === "Fire Trail" ? 7 :
                trailName === "Void Trail" ? 8 :
                trailName === "Rainbow Trail" ? 6 :
                5,
            life:
                trailName === "Void Trail" ? 42 :
                trailName === "Fire Trail" ? 34 :
                28,
            maxLife:
                trailName === "Void Trail" ? 42 :
                trailName === "Fire Trail" ? 34 :
                28,
            color: color
        });
    }

    if (trailParticles.length > 220) {
        trailParticles.splice(0, trailParticles.length - 220);
    }
}

function drawTrail() {
    trailParticles.forEach((p, index) => {
        ctx.save();

        const alpha = p.life / p.maxLife;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;

        ctx.shadowBlur =
            trailName === "Void Trail" ? 35 :
            trailName === "Fire Trail" ? 28 :
            22;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        if (trailName === "Fire Trail") {
            ctx.globalAlpha = alpha * 0.45;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
            ctx.fill();
        }

        if (trailName === "Void Trail") {
            ctx.globalAlpha = alpha * 0.25;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        p.x += p.dx;
        p.y += p.dy;
        p.life--;

        if (trailName === "Void Trail") p.size *= 0.99;
        if (trailName === "Fire Trail") p.size *= 0.985;

        if (p.life <= 0) {
            trailParticles.splice(index, 1);
        }
    });
}

function drawSnake() {
    const smoothSnake = getInterpolatedSnake();

    if (!smoothSnake.length) return;

    const points = smoothSnake.map(part => ({
        x: part.x * gridSize + gridSize / 2,
        y: part.y * gridSize + gridSize / 2
    }));

    if (points.length > 1) {
        drawSnakeRibbon(points);
        drawSnakeTail(points);
    }

    drawSnakeHead(points[0]);
}

function createSnakePath(points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    if (points.length === 2) {
        ctx.lineTo(points[1].x, points[1].y);
        return;
    }

    for (let i = 1; i < points.length - 1; i++) {
        const midX = (points[i].x + points[i + 1].x) / 2;
        const midY = (points[i].y + points[i + 1].y) / 2;

        ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
    }

    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
}

function drawSnakeRibbon(points) {
    const gradient = ctx.createLinearGradient(
        points[points.length - 1].x,
        points[points.length - 1].y,
        points[0].x,
        points[0].y
    );

    gradient.addColorStop(0, skinBody2);
    gradient.addColorStop(0.55, skinBody1);
    gradient.addColorStop(1, skinHead);

    ctx.save();

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    createSnakePath(points);
    ctx.strokeStyle = ghostCharges > 0 ? "rgba(168,85,247,0.38)" : "rgba(255,255,255,0.16)";
    ctx.lineWidth = 22;
    ctx.shadowColor = ghostCharges > 0 ? "#a855f7" : skinBody1;
    ctx.shadowBlur = ghostCharges > 0 ? 34 : 24;
    ctx.stroke();

    createSnakePath(points);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 15;
    ctx.shadowBlur = 14;
    ctx.stroke();

    createSnakePath(points);
    ctx.strokeStyle = ghostCharges > 0 ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.28)";
    ctx.lineWidth = 4;
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.75;
    ctx.stroke();

    ctx.restore();
}

function drawSnakeTail(points) {
    const tail = points[points.length - 1];

    ctx.save();
    ctx.fillStyle = skinBody2;
    ctx.shadowColor = skinBody2;
    ctx.shadowBlur = 16;
    ctx.globalAlpha = ghostCharges > 0 ? 0.55 : 0.85;
    ctx.beginPath();
    ctx.arc(tail.x, tail.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawSnakeHead(head) {
    ctx.save();
    ctx.fillStyle = skinHead;
    ctx.shadowColor = ghostCharges > 0 ? "#a855f7" : skinHead;
    ctx.shadowBlur = ghostCharges > 0 ? 34 : 24;
    ctx.globalAlpha = ghostCharges > 0 ? 0.82 : 1;
    ctx.beginPath();
    ctx.arc(head.x, head.y, 10.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    drawEyes(head);
}

function drawEyes(head) {
    ctx.save();
    ctx.fillStyle = "#07111c";

    let eye1 = {x: 7, y: 7};
    let eye2 = {x: 13, y: 7};

    if (dx === 1) {
        eye1 = {x: 5, y: -4};
        eye2 = {x: 5, y: 4};
    } else if (dx === -1) {
        eye1 = {x: -5, y: -4};
        eye2 = {x: -5, y: 4};
    } else if (dy === 1) {
        eye1 = {x: -4, y: 5};
        eye2 = {x: 4, y: 5};
    } else if (dy === -1) {
        eye1 = {x: -4, y: -5};
        eye2 = {x: 4, y: -5};
    }

    ctx.beginPath();
    ctx.arc(head.x + eye1.x, head.y + eye1.y, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(head.x + eye2.x, head.y + eye2.y, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.arc(head.x + eye1.x + 0.7, head.y + eye1.y - 0.7, 0.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(head.x + eye2.x + 0.7, head.y + eye2.y - 0.7, 0.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function createParticles(x, y, color) {
    const particleCount = effectsQuality === "high" ? 18 : 7;

    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: x,
            y: y,
            dx: (Math.random() - 0.5) * 6,
            dy: (Math.random() - 0.5) * 6,
            life: effectsQuality === "high" ? 28 : 18,
            color: color
        });
    }
}

function drawParticles() {
    particles.forEach((p, index) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 28;

        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;

        p.x += p.dx;
        p.y += p.dy;
        p.life--;

        if (p.life <= 0) {
            particles.splice(index, 1);
        }
    });
}

function drawLevelHud() {
    if (levelTextAnimation <= 0) return;

    const currentMap = getCurrentMap();

    ctx.save();

    ctx.globalAlpha = levelTextAnimation / 45;

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.strokeStyle = currentMap.obstacle;
    ctx.lineWidth = 1;

    drawRoundedStrokeRect(255, 12, 130, 42, 12);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.shadowBlur = 12;
    ctx.shadowColor = currentMap.obstacle;

    ctx.fillText("LEVEL " + level, 320, 30);

    ctx.font = "bold 10px Arial";
    ctx.fillText(currentMap.name, 320, 46);

    ctx.restore();

    levelTextAnimation--;
}

function drawGhostHud() {
    if (ghostCharges <= 0) return;

    ctx.save();

    ctx.fillStyle = "rgba(168,85,247,0.25)";
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 1;

    drawRoundedStrokeRect(12, 340, 115, 42, 12);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "center";
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#a855f7";

    ctx.fillText("GHOST x" + ghostCharges, 69, 365);

    ctx.restore();
}

function drawRoundedStrokeRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.fill();
    ctx.stroke();
}

function drawRoundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.fill();
}

function isSnakeCell(x, y) {
    return snake.some(part => part.x === x && part.y === y);
}

function isObstacleCell(x, y) {
    return obstacles.some(block => block.x === x && block.y === y);
}

function checkCollision() {
    if (!snake.length) return false;

    const head = snake[0];

    if (
        head.x < 0 ||
        head.y < 0 ||
        head.x >= tileCount ||
        head.y >= tileCount
    ) {
        return true;
    }

    for (let i = 1; i < snake.length; i++) {
        if (snake[i].x === head.x && snake[i].y === head.y) {
            return true;
        }
    }

    if (isObstacleCell(head.x, head.y)) {
        if (ghostCharges > 0) {
            ghostCharges--;

            activeEffectText.innerText =
                ghostCharges > 0
                    ? "Призрак x" + ghostCharges
                    : "Нет";

            createParticles(
                head.x * gridSize + 10,
                head.y * gridSize + 10,
                "#a855f7"
            );

            return false;
        }

        return true;
    }

    if (miniBossMode) {
        for (let laser of miniBossLasers) {
            if (
                laser.active &&
                head.x === laser.x &&
                head.y === laser.y
            ) {
                if (ghostCharges > 0) {
                    ghostCharges--;

                    activeEffectText.innerText =
                        ghostCharges > 0
                            ? "Призрак x" + ghostCharges
                            : "Нет";

                    createParticles(
                        head.x * gridSize + 10,
                        head.y * gridSize + 10,
                        "#a855f7"
                    );

                    return false;
                }

                return true;
            }
        }
    }

    return false;
}

function endGame() {
    if (!gameStarted) return;

    clearInterval(gameLoop);
    if (effectTimerInterval) clearInterval(effectTimerInterval);
    if (miniBossInterval) clearInterval(miniBossInterval);
    if (animationFrame) cancelAnimationFrame(animationFrame);

    gameStarted = false;
    gamePaused = false;
    pauseText.hidden = true;
    gameOverlay.hidden = true;
    stopMusic();
    updateSettingsButtons();

    playTone("death");

    if (snake.length) {
        createParticles(
            snake[0].x * gridSize + 10,
            snake[0].y * gridSize + 10,
            "#ff3355"
        );
    }

    gameOverText.style.display = "block";

    saveScore(score);
}

function winGame() {
    if (!gameStarted) return;

    clearInterval(gameLoop);
    if (effectTimerInterval) clearInterval(effectTimerInterval);
    if (miniBossInterval) clearInterval(miniBossInterval);
    if (animationFrame) cancelAnimationFrame(animationFrame);

    gameStarted = false;
    gamePaused = false;
    pauseText.hidden = true;
    gameOverlay.hidden = true;
    stopMusic();
    updateSettingsButtons();

    createParticles(200, 200, "#56ffb1");
    playTone("win");

    winText.style.display = "block";

    saveScore(score);
}

function saveScore(finalScore) {
    fetch('/save_score', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            score: finalScore,
            level: level
        })
    })
    .then(response => response.json())
    .then(data => showResult(finalScore, data))
    .catch(() => showResult(finalScore, null));
}

function showResult(finalScore, data) {
    resultTitle.innerText = level >= finalLevel ? "Победа!" : "Игра окончена";
    resultScore.innerText = finalScore;
    resultCoins.innerText = data && data.earned_coins !== undefined ? data.earned_coins : "-";
    resultBest.innerText = data && data.best_score !== undefined ? data.best_score : bestScore;
    resultLevel.innerText = data && data.best_level !== undefined ? data.best_level : level;

    const unlocked = data && Array.isArray(data.unlocked) ? data.unlocked : [];

    if (unlocked.length) {
        resultAchievements.innerHTML = unlocked
            .map(item => "<div>&#127942; " + item.title + " +" + item.reward + " монет</div>")
            .join("");
    } else {
        resultAchievements.innerText =
            data && data.is_new_best
                ? "Новый рекорд!"
                : "Новых достижений нет";
    }

    resultPanel.hidden = false;
    levelComplete.hidden = true;
    gameOverlay.hidden = false;
}

function showLevelComplete(currentLevel) {
    if (levelCompleteTimer) clearTimeout(levelCompleteTimer);

    levelCompleteText.innerText = "LEVEL " + currentLevel;
    levelComplete.hidden = false;
    levelComplete.classList.remove("level-complete-pop");
    void levelComplete.offsetWidth;
    levelComplete.classList.add("level-complete-pop");

    if (resultPanel.hidden && pauseText.hidden) {
        gameOverlay.hidden = false;
    }

    levelCompleteTimer = setTimeout(hideLevelComplete, 900);
}

function hideLevelComplete() {
    if (levelCompleteTimer) {
        clearTimeout(levelCompleteTimer);
        levelCompleteTimer = null;
    }

    if (!levelComplete) return;

    levelComplete.hidden = true;
    levelComplete.classList.remove("level-complete-pop");

    if (resultPanel.hidden && pauseText.hidden) {
        gameOverlay.hidden = true;
    }
}

function getAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    return audioContext;
}

function playTone(type) {
    if (!soundEnabled) return;

    const audio = getAudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const now = audio.currentTime;

    const settings = {
        eat: {frequency: 620, endFrequency: 920, duration: 0.08, volume: 0.08},
        level: {frequency: 420, endFrequency: 1180, duration: 0.22, volume: 0.1},
        boss: {frequency: 90, endFrequency: 240, duration: 0.42, volume: 0.13},
        death: {frequency: 180, endFrequency: 70, duration: 0.25, volume: 0.11},
        win: {frequency: 520, endFrequency: 1040, duration: 0.32, volume: 0.09}
    }[type];

    if (!settings) return;

    oscillator.type = type === "death" || type === "boss" ? "sawtooth" : "triangle";
    oscillator.frequency.setValueAtTime(settings.frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(settings.endFrequency, now + settings.duration);

    gain.gain.setValueAtTime(settings.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + settings.duration);

    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + settings.duration);
}

function playMusicNote(frequency, duration, volume, delay = 0, wave = "sawtooth", filterFrequency = 900) {
    if (!soundEnabled || gamePaused || !gameStarted) return;

    const audio = getAudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const filter = audio.createBiquadFilter();
    const now = audio.currentTime + delay;

    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, now);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterFrequency, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.04);
}

function playKick(delay = 0) {
    if (!soundEnabled || gamePaused || !gameStarted) return;

    const audio = getAudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const now = audio.currentTime + delay;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(120, now);
    oscillator.frequency.exponentialRampToValueAtTime(45, now + 0.12);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.18);
}

function isDangerMusic() {
    return miniBossMode || level >= 8 || (level >= 6 && ghostCharges === 0);
}

function getMusicInterval() {
    if (miniBossMode) return 330;
    if (level >= 8) return 390;
    if (level >= 5) return 450;
    return 540;
}

function playAmbientStep() {
    if (!soundEnabled || gamePaused || !gameStarted) {
        musicTimer = null;
        return;
    }

    const danger = isDangerMusic();
    const bass = danger
        ? [82.41, 82.41, 98, 73.42, 82.41, 110, 98, 73.42]
        : [65.41, 65.41, 82.41, 73.42, 65.41, 98, 82.41, 73.42];
    const lead = danger
        ? [329.63, 392, 440, 392, 293.66, 329.63, 392, 493.88]
        : [246.94, 293.66, 329.63, 293.66, 220, 246.94, 293.66, 329.63];
    const index = musicStep % bass.length;
    const interval = getMusicInterval();
    const bassVolume = danger ? 0.04 : 0.032;
    const leadVolume = danger ? 0.026 : 0.018;

    playMusicNote(bass[index], interval / 1000 * 0.82, bassVolume, 0, "sawtooth", danger ? 1050 : 760);

    if (musicStep % 4 === 0 || danger) {
        playKick(0);
    }

    if (musicStep % 2 === 0 || danger) {
        playMusicNote(lead[index], 0.14, leadVolume, 0.07, "square", danger ? 1600 : 1150);
    }

    if (musicStep % 8 === 0) {
        playMusicNote(bass[index] * 2, 0.9, 0.018, 0.02, "triangle", 650);
    }

    musicStep++;
    musicTimer = setTimeout(playAmbientStep, interval);
}

function startMusic() {
    if (!soundEnabled || musicTimer || !gameStarted || gamePaused) return;

    musicStep = 0;
    musicTimer = setTimeout(playAmbientStep, 0);
}

function stopMusic() {
    if (!musicTimer) return;

    clearTimeout(musicTimer);
    musicTimer = null;
}

function restartMusic() {
    if (!soundEnabled || !gameStarted || gamePaused) return;

    stopMusic();
    startMusic();
}

function updateSettingsButtons() {
    soundBtn.innerText = soundEnabled ? "Звук: вкл" : "Звук: выкл";
    effectsBtn.innerText = effectsQuality === "high" ? "Эффекты: макс" : "Эффекты: лайт";
    pauseBtn.innerText = gamePaused ? "Продолжить" : "Пауза";
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem("neonSnakeSound", soundEnabled ? "on" : "off");

    if (soundEnabled) {
        startMusic();
    } else {
        stopMusic();
    }

    updateSettingsButtons();
}

function toggleEffectsQuality() {
    effectsQuality = effectsQuality === "high" ? "low" : "high";
    localStorage.setItem("neonSnakeEffects", effectsQuality);

    if (effectsQuality === "low") {
        particles.splice(0, Math.max(0, particles.length - 60));
        trailParticles.splice(0, trailParticles.length);
    }

    updateSettingsButtons();
}

function togglePause() {
    if (!gameStarted) return;

    gamePaused = !gamePaused;
    pauseText.hidden = !gamePaused;
    resultPanel.hidden = true;
    levelComplete.hidden = true;
    gameOverlay.hidden = !gamePaused;

    if (!gamePaused) {
        lastMoveTime = performance.now();
        startMusic();
    } else {
        stopMusic();
    }

    updateSettingsButtons();
}

function setDirection(direction) {
    if (direction === "UP" && dy !== 1) {
        nextDx = 0;
        nextDy = -1;
    }

    if (direction === "DOWN" && dy !== -1) {
        nextDx = 0;
        nextDy = 1;
    }

    if (direction === "LEFT" && dx !== 1) {
        nextDx = -1;
        nextDy = 0;
    }

    if (direction === "RIGHT" && dx !== -1) {
        nextDx = 1;
        nextDy = 0;
    }
}

document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();

    if (key === " " || key === "p" || key === "з") {
        event.preventDefault();
        togglePause();
        return;
    }

    if (key === "enter" && !gameStarted) {
        startGame();
        return;
    }

    if (key === "arrowup" || key === "w") setDirection("UP");
    if (key === "arrowdown" || key === "s") setDirection("DOWN");
    if (key === "arrowleft" || key === "a") setDirection("LEFT");
    if (key === "arrowright" || key === "d") setDirection("RIGHT");
});

let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();

    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, {passive: false});

canvas.addEventListener("touchend", (e) => {
    e.preventDefault();

    let touchEndX = e.changedTouches[0].screenX;
    let touchEndY = e.changedTouches[0].screenY;

    let dxSwipe = touchEndX - touchStartX;
    let dySwipe = touchEndY - touchStartY;

    if (Math.abs(dxSwipe) < 25 && Math.abs(dySwipe) < 25) return;

    if (Math.abs(dxSwipe) > Math.abs(dySwipe)) {
        dxSwipe > 0 ? setDirection("RIGHT") : setDirection("LEFT");
    } else {
        dySwipe > 0 ? setDirection("DOWN") : setDirection("UP");
    }
}, {passive: false});

function toggleFullscreen() {
    const container = document.getElementById("gameContainer");

    if (!document.fullscreenElement) {
        container.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

drawScene();
