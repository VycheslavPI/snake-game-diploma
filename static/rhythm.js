const rhythmCanvas = document.getElementById("rhythmCanvas");
const rhythmCtx = rhythmCanvas.getContext("2d", {alpha: false});
const musicInput = document.getElementById("musicInput");
const rhythmStartBtn = document.getElementById("rhythmStartBtn");
const rhythmStopBtn = document.getElementById("rhythmStopBtn");
const sensitivityInput = document.getElementById("sensitivityInput");
const trackName = document.getElementById("trackName");
const rhythmHint = document.getElementById("rhythmHint");
const rhythmScore = document.getElementById("rhythmScore");
const rhythmCombo = document.getElementById("rhythmCombo");
const rhythmAccuracy = document.getElementById("rhythmAccuracy");
const rhythmBest = document.getElementById("rhythmBest");

const rhythmGrid = 13;
const rhythmTile = rhythmCanvas.width / rhythmGrid;
const hitWindow = 360;

let audioContext = null;
let audioBuffer = null;
let sourceNode = null;
let analyser = null;
let frequencyData = null;
let animationFrame = null;
let isPlaying = false;
let score = 0;
let combo = 0;
let hits = 0;
let misses = 0;
let lastBeatTime = 0;
let bassHistory = [];
let pulses = [];
let notes = [];
let particles = [];
let snake = [{x: 6, y: 6}, {x: 5, y: 6}, {x: 4, y: 6}];
let direction = {x: 1, y: 0};
let pendingSave = false;

function resetRhythmState() {
    score = 0;
    combo = 0;
    hits = 0;
    misses = 0;
    lastBeatTime = 0;
    bassHistory = [];
    pulses = [];
    notes = [];
    particles = [];
    snake = [{x: 6, y: 6}, {x: 5, y: 6}, {x: 4, y: 6}];
    direction = {x: 1, y: 0};
    updateStats();
}

function updateStats() {
    rhythmScore.innerText = score;
    rhythmCombo.innerText = combo;
    const total = hits + misses;
    rhythmAccuracy.innerText = total ? Math.round((hits / total) * 100) + "%" : "0%";
}

function drawRhythmScene() {
    rhythmCtx.fillStyle = "#061a2d";
    rhythmCtx.fillRect(0, 0, rhythmCanvas.width, rhythmCanvas.height);

    rhythmCtx.strokeStyle = "rgba(125,255,207,0.09)";
    rhythmCtx.lineWidth = 1;
    for (let i = 0; i <= rhythmGrid; i++) {
        const pos = i * rhythmTile;
        rhythmCtx.beginPath();
        rhythmCtx.moveTo(pos, 0);
        rhythmCtx.lineTo(pos, rhythmCanvas.height);
        rhythmCtx.stroke();
        rhythmCtx.beginPath();
        rhythmCtx.moveTo(0, pos);
        rhythmCtx.lineTo(rhythmCanvas.width, pos);
        rhythmCtx.stroke();
    }

    drawPulses();
    drawNotes();
    drawSnake();
    drawParticles();

    rhythmCtx.fillStyle = "rgba(159,255,212,0.74)";
    rhythmCtx.font = "bold 18px Arial";
    rhythmCtx.fillText("BASS SYNC", 22, 34);
}

function drawPulses() {
    const now = performance.now();
    pulses = pulses.filter(pulse => now - pulse.time < 900);

    pulses.forEach(pulse => {
        const age = now - pulse.time;
        const progress = age / 900;
        rhythmCtx.save();
        rhythmCtx.globalAlpha = 1 - progress;
        rhythmCtx.strokeStyle = pulse.hit ? "#b7ff00" : "#00e5ff";
        rhythmCtx.lineWidth = 5 - progress * 3;
        rhythmCtx.shadowColor = pulse.hit ? "#b7ff00" : "#00e5ff";
        rhythmCtx.shadowBlur = 22;
        rhythmCtx.beginPath();
        rhythmCtx.arc(rhythmCanvas.width / 2, rhythmCanvas.height / 2, 50 + progress * 230, 0, Math.PI * 2);
        rhythmCtx.stroke();
        rhythmCtx.restore();
    });
}

function drawNotes() {
    const now = performance.now();
    notes = notes.filter(note => now - note.time < 1600);

    notes.forEach(note => {
        const age = now - note.time;
        const pulse = 1 + Math.sin(age / 80) * 0.08;
        const x = note.x * rhythmTile + rhythmTile / 2;
        const y = note.y * rhythmTile + rhythmTile / 2;

        rhythmCtx.save();
        rhythmCtx.globalAlpha = Math.max(0.25, 1 - age / 1600);
        rhythmCtx.fillStyle = note.hit ? "#b7ff00" : "#ff2f68";
        rhythmCtx.shadowColor = note.hit ? "#b7ff00" : "#ff2f68";
        rhythmCtx.shadowBlur = 20;
        rhythmCtx.beginPath();
        rhythmCtx.arc(x, y, 10 * pulse, 0, Math.PI * 2);
        rhythmCtx.fill();
        rhythmCtx.restore();
    });
}

function drawSnake() {
    rhythmCtx.save();
    rhythmCtx.lineCap = "round";
    rhythmCtx.lineJoin = "round";
    rhythmCtx.shadowColor = "#00ff99";
    rhythmCtx.shadowBlur = 18;

    rhythmCtx.beginPath();
    snake.forEach((part, index) => {
        const x = part.x * rhythmTile + rhythmTile / 2;
        const y = part.y * rhythmTile + rhythmTile / 2;
        if (index === 0) rhythmCtx.moveTo(x, y);
        else rhythmCtx.lineTo(x, y);
    });
    rhythmCtx.strokeStyle = "#00ff99";
    rhythmCtx.lineWidth = 18;
    rhythmCtx.stroke();

    const head = snake[0];
    const hx = head.x * rhythmTile + rhythmTile / 2;
    const hy = head.y * rhythmTile + rhythmTile / 2;
    rhythmCtx.fillStyle = "#b7ff00";
    rhythmCtx.beginPath();
    rhythmCtx.arc(hx, hy, 15, 0, Math.PI * 2);
    rhythmCtx.fill();
    rhythmCtx.restore();
}

function drawParticles() {
    particles = particles.filter(particle => particle.life > 0);
    particles.forEach(particle => {
        rhythmCtx.save();
        rhythmCtx.globalAlpha = particle.life / particle.maxLife;
        rhythmCtx.fillStyle = particle.color;
        rhythmCtx.shadowColor = particle.color;
        rhythmCtx.shadowBlur = 12;
        rhythmCtx.beginPath();
        rhythmCtx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        rhythmCtx.fill();
        rhythmCtx.restore();

        particle.x += particle.dx;
        particle.y += particle.dy;
        particle.life--;
    });
}

function createBurst(x, y, color) {
    for (let i = 0; i < 18; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        particles.push({
            x,
            y,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed,
            size: 2 + Math.random() * 4,
            life: 28,
            maxLife: 28,
            color
        });
    }
}

function average(values) {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function analyzeBeat() {
    if (!analyser || !frequencyData) return;

    analyser.getByteFrequencyData(frequencyData);
    const bassBins = Math.max(8, Math.floor(frequencyData.length * 0.08));
    let bass = 0;

    for (let i = 0; i < bassBins; i++) {
        bass += frequencyData[i];
    }

    bass /= bassBins;
    bassHistory.push(bass);
    if (bassHistory.length > 44) bassHistory.shift();

    const baseline = average(bassHistory);
    const now = performance.now();
    const sensitivity = parseFloat(sensitivityInput.value);

    if (bass > Math.max(38, baseline * sensitivity) && now - lastBeatTime > 240) {
        lastBeatTime = now;
        pulses.push({time: now, hit: false});
        spawnNote();
    }
}

function spawnNote() {
    const head = snake[0];
    let x = head.x + direction.x * 2;
    let y = head.y + direction.y * 2;

    if (x < 1 || x > rhythmGrid - 2 || y < 1 || y > rhythmGrid - 2) {
        x = 1 + Math.floor(Math.random() * (rhythmGrid - 2));
        y = 1 + Math.floor(Math.random() * (rhythmGrid - 2));
    }

    notes.push({x, y, time: performance.now(), hit: false});
}

function setDirection(key) {
    const next = {
        ArrowUp: {x: 0, y: -1},
        KeyW: {x: 0, y: -1},
        ArrowDown: {x: 0, y: 1},
        KeyS: {x: 0, y: 1},
        ArrowLeft: {x: -1, y: 0},
        KeyA: {x: -1, y: 0},
        ArrowRight: {x: 1, y: 0},
        KeyD: {x: 1, y: 0},
        Space: direction
    }[key];

    if (!next) return false;
    if (snake.length > 1 && next.x === -direction.x && next.y === -direction.y) return true;
    direction = next;
    return true;
}

function attemptMove() {
    if (!isPlaying) return;

    const now = performance.now();
    const currentPulse = pulses
        .slice()
        .reverse()
        .find(pulse => !pulse.hit && now - pulse.time >= 0 && now - pulse.time <= hitWindow);

    if (!currentPulse) {
        misses++;
        combo = 0;
        createBurst(rhythmCanvas.width / 2, rhythmCanvas.height / 2, "#ff2f68");
        updateStats();
        return;
    }

    currentPulse.hit = true;
    hits++;
    combo++;

    const head = snake[0];
    const nextHead = {
        x: (head.x + direction.x + rhythmGrid) % rhythmGrid,
        y: (head.y + direction.y + rhythmGrid) % rhythmGrid
    };

    snake.unshift(nextHead);
    snake.pop();

    const note = notes.find(item => !item.hit && item.x === nextHead.x && item.y === nextHead.y);
    const bonus = note ? 30 : 0;

    if (note) {
        note.hit = true;
        createBurst(nextHead.x * rhythmTile + rhythmTile / 2, nextHead.y * rhythmTile + rhythmTile / 2, "#b7ff00");
    }

    score += 10 + Math.min(combo, 40) + bonus;
    updateStats();
}

function rhythmLoop() {
    analyzeBeat();
    drawRhythmScene();
    animationFrame = requestAnimationFrame(rhythmLoop);
}

async function loadTrack(file) {
    if (!file) return;

    stopRhythm(false);
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    trackName.innerText = file.name;
    rhythmHint.innerText = "Трек готов. Нажмите старт и двигайтесь только в момент импульса.";
    rhythmStartBtn.disabled = false;
}

async function startRhythm() {
    if (!audioBuffer || isPlaying) return;

    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();
    resetRhythmState();

    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.72;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);

    sourceNode.connect(analyser);
    analyser.connect(audioContext.destination);
    sourceNode.onended = () => stopRhythm(true);
    sourceNode.start();

    isPlaying = true;
    pendingSave = true;
    rhythmStartBtn.disabled = true;
    rhythmStopBtn.disabled = false;
    rhythmHint.innerText = "Ловите импульс: стрелки, WASD или пробел.";
    rhythmLoop();
}

function stopRhythm(shouldSave = true) {
    if (sourceNode) {
        try {
            sourceNode.onended = null;
            sourceNode.stop();
        } catch (error) {}
        sourceNode.disconnect();
        sourceNode = null;
    }

    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }

    const wasPlaying = isPlaying;
    isPlaying = false;
    rhythmStartBtn.disabled = !audioBuffer;
    rhythmStopBtn.disabled = true;

    if (shouldSave && wasPlaying && pendingSave) {
        pendingSave = false;
        saveRhythmScore();
    }

    drawRhythmScene();
}

async function saveRhythmScore() {
    rhythmHint.innerText = "Сохраняю результат...";

    try {
        const response = await fetch("/save_rhythm_score", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({score})
        });
        const result = await response.json();

        if (result.status === "success") {
            rhythmBest.innerText = result.best_score;
            rhythmHint.innerText = result.is_new_best
                ? "Новый рекорд! Монеты: +" + result.earned_coins
                : "Результат сохранён. Монеты: +" + result.earned_coins;
        } else {
            rhythmHint.innerText = "Не удалось сохранить результат.";
        }
    } catch (error) {
        rhythmHint.innerText = "Сеть недоступна, результат не сохранён.";
    }
}

musicInput.addEventListener("change", event => {
    loadTrack(event.target.files[0]).catch(() => {
        rhythmHint.innerText = "Не удалось прочитать этот аудиофайл.";
    });
});

rhythmStartBtn.addEventListener("click", startRhythm);
rhythmStopBtn.addEventListener("click", () => stopRhythm(true));

window.addEventListener("keydown", event => {
    if (!setDirection(event.code)) return;
    event.preventDefault();
    attemptMove();
});

rhythmCanvas.addEventListener("pointerdown", event => {
    const rect = rhythmCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const dx = x - centerX;
    const dy = y - centerY;

    if (Math.abs(dx) > Math.abs(dy)) {
        direction = dx > 0 ? {x: 1, y: 0} : {x: -1, y: 0};
    } else {
        direction = dy > 0 ? {x: 0, y: 1} : {x: 0, y: -1};
    }

    attemptMove();
});

drawRhythmScene();
