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
const rhythmLives = document.getElementById("rhythmLives");
const rhythmBest = document.getElementById("rhythmBest");

const laneCount = 5;
const hitLineY = rhythmCanvas.height - 92;
const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
const noteTravelTime = isTouchDevice ? 2500 : 2250;
const catchWindow = 44;
const maxActiveNotes = isTouchDevice ? 3 : 4;
const laneColors = ["#00e5ff", "#37ffb3", "#b7ff00", "#facc15", "#ff2f68"];

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
let lives = 5;
let lastBeatTime = 0;
let lastScheduledTarget = 0;
let lastFrameTime = performance.now();
let previousSpectrum = null;
let fluxHistory = [];
let beatIntervals = [];
let estimatedBeatInterval = 620;
let notes = [];
let pulses = [];
let particles = [];
let playerLane = 2;
let playerLaneTarget = 2;
let pendingSave = false;
let gameEnded = false;

function laneX(lane) {
    return ((lane + 0.5) / laneCount) * rhythmCanvas.width;
}

function resetRhythmState() {
    score = 0;
    combo = 0;
    hits = 0;
    misses = 0;
    lives = 5;
    lastBeatTime = 0;
    lastScheduledTarget = 0;
    lastFrameTime = performance.now();
    previousSpectrum = null;
    fluxHistory = [];
    beatIntervals = [];
    estimatedBeatInterval = 620;
    notes = [];
    pulses = [];
    particles = [];
    playerLane = 2;
    playerLaneTarget = 2;
    gameEnded = false;
    updateStats();
}

function updateStats() {
    rhythmScore.innerText = score;
    rhythmCombo.innerText = combo;
    rhythmLives.innerText = lives;
    const total = hits + misses;
    rhythmAccuracy.innerText = total ? Math.round((hits / total) * 100) + "%" : "0%";
}

function drawRhythmScene() {
    rhythmCtx.fillStyle = "#061a2d";
    rhythmCtx.fillRect(0, 0, rhythmCanvas.width, rhythmCanvas.height);

    drawLanes();
    drawPulses();
    drawNotes();
    drawCatcher();
    drawParticles();

    rhythmCtx.fillStyle = "rgba(159,255,212,0.78)";
    rhythmCtx.font = "bold 18px Arial";
    rhythmCtx.fillText("NOTE CATCH", 22, 34);
}

function drawLanes() {
    const laneWidth = rhythmCanvas.width / laneCount;

    for (let lane = 0; lane < laneCount; lane++) {
        const x = lane * laneWidth;
        const center = laneX(lane);

        rhythmCtx.fillStyle = lane % 2 === 0 ? "rgba(255,255,255,0.018)" : "rgba(255,255,255,0.034)";
        rhythmCtx.fillRect(x, 0, laneWidth, rhythmCanvas.height);

        rhythmCtx.strokeStyle = "rgba(125,255,207,0.14)";
        rhythmCtx.lineWidth = 1;
        rhythmCtx.beginPath();
        rhythmCtx.moveTo(x, 0);
        rhythmCtx.lineTo(x, rhythmCanvas.height);
        rhythmCtx.stroke();

        rhythmCtx.save();
        rhythmCtx.globalAlpha = 0.3;
        rhythmCtx.strokeStyle = laneColors[lane];
        rhythmCtx.lineWidth = 3;
        rhythmCtx.beginPath();
        rhythmCtx.moveTo(center, 0);
        rhythmCtx.lineTo(center, rhythmCanvas.height);
        rhythmCtx.stroke();
        rhythmCtx.restore();
    }

    rhythmCtx.save();
    rhythmCtx.strokeStyle = "#9fffd4";
    rhythmCtx.lineWidth = 4;
    rhythmCtx.shadowColor = "#37ffb3";
    rhythmCtx.shadowBlur = 18;
    rhythmCtx.beginPath();
    rhythmCtx.moveTo(18, hitLineY);
    rhythmCtx.lineTo(rhythmCanvas.width - 18, hitLineY);
    rhythmCtx.stroke();

    rhythmCtx.fillStyle = "rgba(55,255,179,0.08)";
    rhythmCtx.fillRect(0, hitLineY - catchWindow, rhythmCanvas.width, catchWindow * 2);
    rhythmCtx.restore();
}

function drawPulses() {
    if (isTouchDevice) return;

    const now = performance.now();
    pulses = pulses.filter(pulse => now - pulse.time < 650);

    pulses.forEach(pulse => {
        const progress = (now - pulse.time) / 650;
        rhythmCtx.save();
        rhythmCtx.globalAlpha = 1 - progress;
        rhythmCtx.strokeStyle = pulse.color;
        rhythmCtx.lineWidth = 4 - progress * 2;
        rhythmCtx.shadowColor = pulse.color;
        rhythmCtx.shadowBlur = 20;
        rhythmCtx.beginPath();
        rhythmCtx.arc(laneX(pulse.lane), hitLineY, 22 + progress * 62, 0, Math.PI * 2);
        rhythmCtx.stroke();
        rhythmCtx.restore();
    });
}

function drawNotes() {
    notes.forEach(note => {
        const x = laneX(note.lane);
        const pulse = 1 + Math.sin(performance.now() / 80) * 0.06;

        rhythmCtx.save();
        rhythmCtx.fillStyle = note.color;
        rhythmCtx.shadowColor = note.color;
        rhythmCtx.shadowBlur = isTouchDevice ? 8 : 22;
        rhythmCtx.beginPath();
        rhythmCtx.roundRect(x - 28 * pulse, note.y - 14 * pulse, 56 * pulse, 28 * pulse, 10);
        rhythmCtx.fill();

        rhythmCtx.fillStyle = "rgba(255,255,255,0.72)";
        rhythmCtx.beginPath();
        rhythmCtx.arc(x + 12, note.y - 5, 4, 0, Math.PI * 2);
        rhythmCtx.fill();
        rhythmCtx.restore();
    });
}

function drawCatcher() {
    playerLane += (playerLaneTarget - playerLane) * (isTouchDevice ? 1 : 0.35);
    const x = laneX(playerLane);

    rhythmCtx.save();
    rhythmCtx.shadowColor = "#00ff99";
    rhythmCtx.shadowBlur = isTouchDevice ? 10 : 24;
    rhythmCtx.fillStyle = "#00ff99";
    rhythmCtx.beginPath();
    rhythmCtx.roundRect(x - 46, hitLineY + 32, 92, 24, 12);
    rhythmCtx.fill();

    rhythmCtx.fillStyle = "#b7ff00";
    rhythmCtx.beginPath();
    rhythmCtx.arc(x, hitLineY + 25, 18, 0, Math.PI * 2);
    rhythmCtx.fill();

    rhythmCtx.fillStyle = "#07182a";
    rhythmCtx.beginPath();
    rhythmCtx.arc(x - 6, hitLineY + 20, 3, 0, Math.PI * 2);
    rhythmCtx.arc(x + 6, hitLineY + 20, 3, 0, Math.PI * 2);
    rhythmCtx.fill();
    rhythmCtx.restore();
}

function drawParticles() {
    if (isTouchDevice && particles.length > 18) {
        particles.splice(0, particles.length - 18);
    }

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
    const count = isTouchDevice ? 7 : 18;

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3.4;
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

    const lowBinCount = Math.max(18, Math.floor(frequencyData.length * 0.16));
    let flux = 0;

    if (previousSpectrum) {
        for (let i = 1; i < lowBinCount; i++) {
            const diff = frequencyData[i] - previousSpectrum[i];
            if (diff > 0) {
                flux += diff * (1 - i / (lowBinCount * 1.35));
            }
        }
    }

    previousSpectrum = new Uint8Array(frequencyData);
    flux /= lowBinCount;
    fluxHistory.push(flux);
    if (fluxHistory.length > 60) fluxHistory.shift();

    const baseline = average(fluxHistory);
    const now = performance.now();
    const density = parseFloat(sensitivityInput.value);
    const thresholdMultiplier = 2.35 - density * 0.42;
    const minBeatGap = Math.round(620 - density * 140) + (isTouchDevice ? 130 : 0);
    const isOnset = flux > Math.max(7, baseline * thresholdMultiplier);

    if (
        isOnset &&
        now - lastBeatTime > minBeatGap &&
        notes.length < maxActiveNotes
    ) {
        registerBeat(now);
    }
}

function registerBeat(now) {
    if (lastBeatTime > 0) {
        const interval = now - lastBeatTime;

        if (interval >= 320 && interval <= 1200) {
            beatIntervals.push(interval);
            if (beatIntervals.length > 8) beatIntervals.shift();
            estimatedBeatInterval = average(beatIntervals);
        }
    }

    lastBeatTime = now;
    schedulePredictedNote(now);
}

function schedulePredictedNote(now) {
    let targetTime = now + estimatedBeatInterval;

    while (targetTime - now < noteTravelTime) {
        targetTime += estimatedBeatInterval;
    }

    if (targetTime - lastScheduledTarget < estimatedBeatInterval * 0.55) {
        return;
    }

    lastScheduledTarget = targetTime;
    spawnFallingNote(targetTime, now);
}

function spawnFallingNote(targetTime, now) {
    const lane = Math.floor(Math.random() * laneCount);
    const color = laneColors[lane];

    notes.push({
        lane,
        y: -28,
        spawnTime: now,
        targetTime,
        color,
        caught: false
    });

    pulses.push({lane, color, time: performance.now()});
}

function updateNotes(delta) {
    notes.forEach(note => {
        const progress = (performance.now() - note.spawnTime) / (note.targetTime - note.spawnTime);
        note.y = -28 + progress * (hitLineY + 28);
    });

    notes = notes.filter(note => {
        if (note.caught) return false;

        const laneMatch = Math.round(playerLane) === note.lane;
        const distance = Math.abs(note.y - hitLineY);

        if (laneMatch && distance <= catchWindow) {
            catchNote(note, distance);
            return false;
        }

        if (note.y > hitLineY + catchWindow + 28) {
            missNote(note);
            return false;
        }

        return true;
    });
}

function catchNote(note, distance) {
    note.caught = true;
    hits++;
    combo++;

    const timingBonus = Math.max(0, Math.round((1 - distance / catchWindow) * 40));
    score += 25 + timingBonus + Math.min(combo, 60);

    createBurst(laneX(note.lane), hitLineY, note.color);
    updateStats();
}

function missNote(note) {
    misses++;
    lives--;
    combo = 0;
    createBurst(laneX(note.lane), hitLineY + 18, "#ff2f68");
    updateStats();

    if (lives <= 0) {
        endRhythmGame();
    }
}

function movePlayer(direction) {
    playerLaneTarget = Math.max(0, Math.min(laneCount - 1, playerLaneTarget + direction));
}

function setPlayerLane(lane, instant = false) {
    playerLaneTarget = Math.max(0, Math.min(laneCount - 1, lane));

    if (instant) {
        playerLane = playerLaneTarget;
    }
}

function laneFromPointer(event) {
    const rect = rhythmCanvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width - 1, event.clientX - rect.left));
    return Math.floor((x / rect.width) * laneCount);
}

function rhythmLoop() {
    const now = performance.now();
    const delta = Math.min(50, now - lastFrameTime);
    lastFrameTime = now;

    analyzeBeat();
    updateNotes(delta);
    drawRhythmScene();

    if (isPlaying) {
        animationFrame = requestAnimationFrame(rhythmLoop);
    }
}

async function loadTrack(file) {
    if (!file) return;

    stopRhythm(false);
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    trackName.innerText = file.name;
    rhythmHint.innerText = "Трек готов. Нажмите старт: ноты будут падать сверху, ловите их в нижней зоне.";
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
    rhythmHint.innerText = "Двигайтесь влево/вправо: A/D, стрелки или тап по дорожке.";
    rhythmLoop();
}

function endRhythmGame() {
    rhythmHint.innerText = "Поражение: жизни закончились. Сохраняю результат...";
    stopRhythm(true);
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
    if (["ArrowLeft", "KeyA"].includes(event.code)) {
        event.preventDefault();
        movePlayer(-1);
    }

    if (["ArrowRight", "KeyD"].includes(event.code)) {
        event.preventDefault();
        movePlayer(1);
    }
});

rhythmCanvas.addEventListener("pointerdown", event => {
    event.preventDefault();
    setPlayerLane(laneFromPointer(event), true);
    rhythmCanvas.setPointerCapture(event.pointerId);
}, {passive: false});

rhythmCanvas.addEventListener("pointermove", event => {
    if (event.buttons !== 1 && event.pointerType !== "touch") return;

    event.preventDefault();
    setPlayerLane(laneFromPointer(event), true);
}, {passive: false});

drawRhythmScene();
