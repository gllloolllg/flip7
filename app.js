/**
 * Board Game Score Logic
 */
const STORAGE_KEY = 'bg_score_app_v1';
const GOAL_SCORE = 200;
const VISUAL_MAX_SCORE = 250;
const PLAYER_COLORS = [
    '#3b82f6', // Blue (Default)
    '#ef4444', // Red
    '#10b981', // Green
    '#f59e0b', // Amber
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#f97316'  // Orange
];

// State
let state = {
    players: [], // { id, name, scores: [], total: 0, color: string }
    round: 1,
    history: [],
    status: 'ENTRY' // ENTRY, PLAYING, RESULT
};

// DOM Elements
const views = {
    entry: document.getElementById('view-entry'),
    score: document.getElementById('view-score'),
    input: document.getElementById('view-input'),
    result: document.getElementById('view-result')
};
const inputContainer = document.getElementById('input-form-container');

// --- Initialization ---
function init() {
    loadState();
    if (state.status === 'PLAYING') {
        showView('score');
        renderScoreboard();
    } else if (state.status === 'RESULT') {
        showView('result');
        renderResult();
    } else {
        showView('entry');
        renderEntryList();
    }
    bindEvents();
}

// --- State Management ---
function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        state = JSON.parse(saved);
        // Recalculate totals just in case
        state.players.forEach(p => {
            p.total = p.scores.reduce((a, b) => a + b, 0);
            // Backfill color if missing (for existing saves)
            if (!p.color) {
                // We need a stable assignment for existing saves. 
            }
        });

        // Fix missing colors for loaded players
        state.players.forEach((p, index) => {
            if (!p.color) {
                p.color = PLAYER_COLORS[index % PLAYER_COLORS.length];
            }
        });
    }
}

function resetGame() {
    localStorage.removeItem(STORAGE_KEY);
    state = {
        players: [],
        round: 1,
        status: 'ENTRY'
    };
    document.getElementById('score-chart-container').innerHTML = ''; // Clear DOM map
    renderEntryList();
    showView('entry');
    // modal.classList.remove('active'); // Removed
    stopConfetti(); // Clean up
}

function startGame() {
    if (state.players.length === 0) return;
    state.status = 'PLAYING';
    saveState();
    showView('score');
    renderScoreboard();
}

function addPlayer(name) {
    if (!name.trim()) return;
    const color = PLAYER_COLORS[state.players.length % PLAYER_COLORS.length];
    state.players.push({
        id: Date.now() + Math.random(),
        name: name.trim(),
        scores: [],
        total: 0,
        color: color
    });
    saveState();
    renderEntryList();
}

// --- View Rendering ---
function showView(viewName) {
    Object.values(views).forEach(el => el.classList.remove('active'));
    views[viewName].classList.add('active');
}

// Entry View
function renderEntryList() {
    const list = document.getElementById('player-list-entry');
    list.innerHTML = '';
    state.players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.name;
        list.appendChild(li);
    });
    document.getElementById('start-game-btn').disabled = state.players.length === 0;
}

// Score View
const ROW_HEIGHT = 64; // 48px bar + 16px gap

function renderScoreboard() {
    document.getElementById('round-display').textContent = state.round;
    const container = document.getElementById('score-chart-container');

    // Ensure container height is sufficient
    container.style.height = `${state.players.length * ROW_HEIGHT + 100}px`;

    // Sort by total for position calculation
    const sortedPlayers = [...state.players].sort((a, b) => b.total - a.total);

    // Create map of current sorted index
    const indexMap = new Map();
    sortedPlayers.forEach((p, i) => indexMap.set(p.id, i));

    // Reconcile DOM
    state.players.forEach(p => {
        let row = document.getElementById(`player-row-${p.id}`);

        // Create if not exists
        if (!row) {
            row = document.createElement('div');
            row.id = `player-row-${p.id}`;
            row.className = 'player-row';
            // Fallback color if something went wrong
            const barColor = p.color || PLAYER_COLORS[0];

            row.innerHTML = `
                <div class="bar-track">
                    <div class="bar-fill" style="width: 0%; background: ${barColor}; border-color: ${barColor};"></div>
                    <div class="goal-line"></div>
                    <div class="player-name-overlay">${p.name}</div>
                    <div class="player-score-overlay">0</div>
                </div>
            `;
            container.appendChild(row);
        }

        // Update Position
        const targetIndex = indexMap.get(p.id);
        row.style.transform = `translateY(${targetIndex * ROW_HEIGHT}px)`;

        // Update Data
        updateRowData(row, p);
    });
}

function updateRowData(rowElement, player) {
    const percentage = Math.min((player.total / VISUAL_MAX_SCORE) * 100, 100);
    const barFill = rowElement.querySelector('.bar-fill');
    const scoreText = rowElement.querySelector('.player-score-overlay');

    // Update width
    barFill.style.width = `${percentage}%`;

    // Update text
    scoreText.textContent = player.total;
}

// Result View
function renderResult() {
    const list = document.getElementById('ranking-list');
    list.innerHTML = '';
    const sorted = [...state.players].sort((a, b) => b.total - a.total);

    sorted.forEach((p, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="rank">${index + 1}</span>
            <span class="name">${p.name}</span>
            <span class="total">${p.total}</span>
        `;
        list.appendChild(li);
    });
}

// --- Input Handling ---
let tempScores = {}; // { playerId: string_score }
let currentFocusPlayerId = null;

function startInputSequence() {
    tempScores = {};
    state.players.forEach(p => {
        tempScores[p.id] = ''; // Start empty
    });

    // Default focus first player
    if (state.players.length > 0) {
        currentFocusPlayerId = state.players[0].id;
    }

    renderInputPlayerList();

    showView('input');
}

function renderInputPlayerList() {
    const list = document.getElementById('input-player-list');
    list.innerHTML = '';

    state.players.forEach(p => {
        const li = document.createElement('li');
        li.className = 'input-player-row';
        if (p.id === currentFocusPlayerId) {
            li.classList.add('active');
        }

        li.onclick = () => {
            currentFocusPlayerId = p.id;
            renderInputPlayerList();
        };

        const scoreVal = tempScores[p.id];
        const displayScore = scoreVal === '' ? '-' : scoreVal;
        const scoreClass = scoreVal === '' ? 'score-input empty' : 'score-input';

        li.innerHTML = `
            <span class="name">${p.name}</span>
            <span class="${scoreClass}">${displayScore}</span>
        `;
        list.appendChild(li);

        // Ensure active element is visible
        if (p.id === currentFocusPlayerId) {
            li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });
}

function finishRound() {
    state.round++;

    // Commit scores
    state.players.forEach(p => {
        const val = tempScores[p.id];
        const score = val === '' ? 0 : parseInt(val, 10);
        p.scores.push(score);
        p.total += score;
    });

    // Check game end
    const argsLimit = state.players.some(p => p.total >= GOAL_SCORE);

    if (argsLimit) {
        // Just show the final state immediately, or delay seeing the result?
        // Let's animate first, then show result.
        saveState();
        showView('score');

        // 1. Animate Bars Growth
        setTimeout(() => {
            updateBarsOnly();
        }, 50);

        // 2. Wait 2s then Reorder & Show Result
        setTimeout(() => {
            renderScoreboard(); // Sorts and moves rows
            setTimeout(() => {
                state.status = 'RESULT';
                saveState();
                showView('result');
                renderResult();
                startConfetti(); // Trigger Animation
            }, 1000); // Give time to see the reorder
        }, 2000);

    } else {
        saveState();
        showView('score');

        // 1. Animate Bars Growth (Visual update only, no reorder yet)
        setTimeout(() => {
            updateBarsOnly();
        }, 50);

        // 2. Wait 2s then Reorder
        setTimeout(() => {
            renderScoreboard(); // This will recalculate sort and update positions
        }, 2000);
    }
}

function updateBarsOnly() {
    state.players.forEach(p => {
        const row = document.getElementById(`player-row-${p.id}`);
        if (row) {
            updateRowData(row, p);
        }
    });
}

// Numpad Logic

function handleNumpad(key) {
    if (currentFocusPlayerId === null) return;

    let currentVal = tempScores[currentFocusPlayerId] || '';

    if (key === 'OK') {
        // Move to next player
        const idx = state.players.findIndex(p => p.id === currentFocusPlayerId);
        if (idx !== -1 && idx < state.players.length - 1) {
            const nextPlayer = state.players[idx + 1];
            currentFocusPlayerId = nextPlayer.id;
            renderInputPlayerList();
        }
    } else if (key === 'C') {
        currentVal = '';
        tempScores[currentFocusPlayerId] = currentVal;
        renderInputPlayerList();
    } else {
        // Number
        if (currentVal === '0' || currentVal === '') {
            currentVal = key;
        } else {
            if (currentVal.length < 5) { // Prevent overflow
                currentVal += key;
            }
        }
        tempScores[currentFocusPlayerId] = currentVal;
        renderInputPlayerList();
    }
}


// --- Events ---
function bindEvents() {
    // Entry
    document.getElementById('add-player-btn').onclick = () => {
        const input = document.getElementById('player-name-input');
        addPlayer(input.value);
        input.value = '';
        input.focus();
    };

    // Enter Key Support
    document.getElementById('player-name-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('add-player-btn').click();
        }
    });

    // iOS Keyboard Scroll Fix
    document.getElementById('player-name-input').addEventListener('blur', () => {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
    });

    document.getElementById('start-game-btn').onclick = startGame;

    // Base Score View
    // Trigger via Round Indicator
    document.getElementById('round-trigger').onclick = () => {
        startInputSequence();
    };

    // Modal
    document.getElementById('close-input-btn').onclick = () => {
        showView('score');
    };

    document.getElementById('next-round-btn').onclick = () => {
        finishRound();
    };

    // --- Reset Confirmation Logic ---
    const toggleModalSection = (showConfirm) => {
        const inputForm = document.getElementById('input-form-container');
        const confirmSection = document.getElementById('input-confirm');

        if (showConfirm) {
            inputForm.classList.remove('active');
            inputForm.classList.add('hidden');
            confirmSection.classList.remove('hidden');
            confirmSection.classList.add('active');
        } else {
            confirmSection.classList.remove('active');
            confirmSection.classList.add('hidden');
            inputForm.classList.remove('hidden');
            inputForm.classList.add('active');
        }
    };

    document.getElementById('new-game-btn').onclick = () => {
        toggleModalSection(true);
    };

    document.getElementById('confirm-reset-btn').onclick = () => {
        resetGame();
        toggleModalSection(false); // Reset UI state for next time
    };

    document.getElementById('cancel-reset-btn').onclick = () => {
        toggleModalSection(false);
    };

    document.querySelectorAll('.numpad button').forEach(btn => {
        btn.onclick = () => handleNumpad(btn.dataset.val);
    });

    // Result
    document.getElementById('back-to-home-btn').onclick = () => {
        resetGame();
    };
}

// Start
init();


// --- Confetti Logic ---
const confettiCanvas = document.getElementById('confetti-canvas');
const ctx = confettiCanvas.getContext('2d');
let confettiActive = false;
let particles = [];

function resizeCanvas() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function createConfetti() {
    const particleCount = 100;
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ffd700'];

    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * confettiCanvas.width,
            y: Math.random() * confettiCanvas.height - confettiCanvas.height,
            size: Math.random() * 10 + 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            speedY: Math.random() * 3 + 2,
            speedX: Math.random() * 2 - 1,
            rotation: Math.random() * 360,
            rotationSpeed: Math.random() * 5 - 2.5
        });
    }
}

function updateConfetti() {
    if (!confettiActive) return;

    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    particles.forEach((p, i) => {
        p.y += p.speedY;
        p.x += p.speedX;
        p.rotation += p.rotationSpeed;

        // Reset if out of bounds
        if (p.y > confettiCanvas.height) {
            p.y = -20;
            p.x = Math.random() * confettiCanvas.width;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
    });

    requestAnimationFrame(updateConfetti);
}

function startConfetti() {
    if (confettiActive) return;
    confettiActive = true;
    particles = [];
    createConfetti();
    updateConfetti();
}

function stopConfetti() {
    confettiActive = false;
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    particles = [];
}
