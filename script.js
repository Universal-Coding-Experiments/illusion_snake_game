
const _b64 = {
    secretWord: 'b3BlbnNlc2FtZQ==',
    adminPwd: 'czNjcjN0'
};
function decodeB64(s) { try { return atob(s); } catch (e) { return ''; } }
const SECRET_WORD = decodeB64(_b64.secretWord);
const ADMIN_PASSWORD = decodeB64(_b64.adminPwd);
const LB_KEY = 'illusion_snake_leaderboard_v1';
const container = document.getElementById('container');
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha: false });
let DPR = Math.max(1, window.devicePixelRatio || 1);
let size = 400;
function resizeCanvas() {
    const rect = container.getBoundingClientRect();
    size = Math.min(rect.width, rect.height);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    canvas.width = Math.round(size * DPR);
    canvas.height = Math.round(size * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', () => { resizeCanvas(); draw(); });
resizeCanvas();
const gridCount = 20;
let snake = [{ x: 10, y: 10 }];
let dir = { x: 1, y: 0 };
let nextDir = null;
let food = { x: 15, y: 15 };
let score = 0;
let running = false;
let tickInterval = 120;
let tickTimer = null;
let playerName = sessionStorage.getItem('playerName') || '';
let wasRunningBeforeAdmin = false;
const startOverlay = document.getElementById('startOverlay');
const playerNameInput = document.getElementById('playerName');
const startBtn = document.getElementById('startBtn');
const stateLabel = document.getElementById('stateLabel');
const scoreLabel = document.getElementById('scoreLabel');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const finalScore = document.getElementById('finalScore');
const playAgain = document.getElementById('playAgain');
const toLeaderboard = document.getElementById('toLeaderboard');
const leaderboardOverlay = document.getElementById('leaderboardOverlay');
const leaderboardList = document.getElementById('leaderboardList');
const viewLB = document.getElementById('viewLB');
const closeLB = document.getElementById('closeLB');
const adminOverlay = document.getElementById('adminOverlay');
const adminClear = document.getElementById('adminClear');
const adminClose = document.getElementById('adminClose');
const tapBtn = document.getElementById('tapBtn');
const dpad = document.getElementById('dpad');
const adminHint = document.getElementById('adminHint');
const adminInputWrap = document.getElementById('adminInputWrap');
const adminCodeInput = document.getElementById('adminCodeInput');
const adminCodeCancel = document.getElementById('adminCodeCancel');
const adminPasswordPanel = document.getElementById('adminPasswordPanel');
const adminPasswordInput = document.getElementById('adminPasswordInput');
const adminPasswordSubmit = document.getElementById('adminPasswordSubmit');
const adminPasswordCancel = document.getElementById('adminPasswordCancel');
const foodSound = new Audio("sounds/food.mp3");
const failSound = new Audio("sounds/fail.mp3");
const mobileControls = document.getElementById('mobileControls');
function isAnyOverlayOrInputActive() {
    const overlays = [adminInputWrap, adminPasswordPanel, adminOverlay, leaderboardOverlay, startOverlay, gameOverOverlay];
    for (const el of overlays) {
        if (!el) continue;
        if (!el.classList.contains('hidden') && el.style.display !== 'none') return true;
    }
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return true;
    return false;
}
function readLeaderboard() {
    try { const raw = localStorage.getItem(LB_KEY); return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
}
function writeLeaderboard(list) { try { localStorage.setItem(LB_KEY, JSON.stringify(list)); } catch (e) { } }
function submitScore(name, score) {
    if (!name) return;
    const list = readLeaderboard();
    list.push({ name, score, ts: Date.now() });
    list.sort((a, b) => b.score - a.score || b.ts - a.ts);
    writeLeaderboard(list.slice(0, 200));
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function renderLeaderboard() {
    const list = readLeaderboard();
    leaderboardList.innerHTML = '';
    if (list.length === 0) {
        leaderboardList.innerHTML = '<div class="small">No scores yet</div>';
        return;
    }
    list.sort((a, b) => b.score - a.score || b.ts - a.ts);
    const top3 = list.slice(0, 3);
    const rest = list.slice(3);
    const header = document.createElement('div');
    header.style.marginBottom = '8px';
    header.innerHTML = '<div style="font-weight:700;margin-bottom:6px">All‑time Top 3</div>';
    leaderboardList.appendChild(header);
    top3.forEach((row, idx) => {
        const el = document.createElement('div');
        el.className = 'lb-row';
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
        el.innerHTML = `<div>${medal} ${idx + 1}. ${escapeHtml(row.name)}</div><div>${row.score}</div>`;
        leaderboardList.appendChild(el);
    });
    if (rest.length > 0) {
        const sep = document.createElement('div');
        sep.style.margin = '10px 0 6px';
        sep.style.opacity = '0.8';
        sep.textContent = 'Other top scores';
        leaderboardList.appendChild(sep);
        rest.slice(0, 50).forEach((row, idx) => {
            const el = document.createElement('div');
            el.className = 'lb-row';
            el.innerHTML = `<div>${idx + 4}. ${escapeHtml(row.name)}</div><div>${row.score}</div>`;
            leaderboardList.appendChild(el);
        });
    }
}
function resetGame() {
    const mid = Math.floor(gridCount / 2);
    snake = [{ x: mid, y: mid }];
    dir = { x: 1, y: 0 };
    nextDir = null;
    placeFood();
    score = 0;
    updateHUD();
}
function placeFood() {
    const max = gridCount;
    let tries = 0;
    while (tries++ < 200) {
        const fx = Math.floor(Math.random() * max);
        const fy = Math.floor(Math.random() * max);
        if (!snake.some(s => s.x === fx && s.y === fy)) { food = { x: fx, y: fy }; return; }
    }
    food = { x: Math.floor(Math.random() * max), y: Math.floor(Math.random() * max) };
}
function updateHUD() { scoreLabel.textContent = 'Score: ' + score; }
function setDirection(dx, dy) {
    if (dx === -dir.x && dy === -dir.y) return;
    nextDir = { x: dx, y: dy };
}
function tick() {
    if (nextDir) { dir = nextDir; nextDir = null; }
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (head.x < 0 || head.y < 0 || head.x >= gridCount || head.y >= gridCount || snake.some(s => s.x === head.x && s.y === head.y)) {
        running = false;
        clearInterval(tickTimer); tickTimer = null;
        onGameOver(); return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
        score++;
        foodSound.play();
        placeFood();
        updateHUD();
        if (score % 5 === 0 && tickInterval > 50) {
            tickInterval = Math.max(50, tickInterval - 8);
            if (running) { clearInterval(tickTimer); tickTimer = setInterval(tick, tickInterval); }
        }
    } else {
        snake.pop();
    }
}
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width / DPR;
    const h = canvas.height / DPR;
    const cellSize = Math.min(w, h) / gridCount;
    ctx.fillStyle = '#111214';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ff4d4d';
    ctx.fillRect(food.x * cellSize + 1, food.y * cellSize + 1, cellSize - 2, cellSize - 2);
    const now = Date.now();
    snake.forEach((s, i) => {
        const cx = s.x * cellSize + cellSize / 2;
        const cy = s.y * cellSize + cellSize / 2;
        ctx.save();
        ctx.translate(cx, cy);
        const rot = (now / 200) + i * 0.18;
        ctx.rotate(rot);
        ctx.fillStyle = (i % 2 === 0) ? '#ffffff' : '#000000';
        const pad = Math.max(2, cellSize * 0.08);
        ctx.fillRect(-cellSize / 2 + pad, -cellSize / 2 + pad, cellSize - pad * 2, cellSize - pad * 2);
        ctx.restore();
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}
function pauseGameAndHide() {
    wasRunningBeforeAdmin = running;
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    running = false;
    canvas.style.visibility = 'hidden';
    mobileControls.style.display = 'none';
    stateLabel.textContent = 'Paused for admin';
}
function resumeGameAndShow() {
    canvas.style.visibility = 'visible';
    mobileControls.style.display = '';
    if (wasRunningBeforeAdmin) {
        if (!tickTimer) {
            tickTimer = setInterval(tick, tickInterval);
            running = true;
            stateLabel.textContent = 'Playing';
        }
    } else {
        stateLabel.textContent = 'Tap to start';
    }
}
function onGameOver() {
    finalScore.textContent = 'Score: ' + score;
    document.getElementById('gameOverTitle').textContent = 'Game Over';
    gameOverOverlay.classList.remove('hidden');
    stateLabel.textContent = 'Game over';
    failSound.play();
    if (playerName) submitScore(playerName, score);
}
function startGame() {
    const name = (playerNameInput.value || '').trim();
    if (!name) { playerNameInput.focus(); return; }
    playerName = name;
    sessionStorage.setItem('playerName', playerName);
    startOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    leaderboardOverlay.classList.add('hidden');
    adminOverlay.classList.add('hidden');
    resetGame();
    running = true;
    tickInterval = 120;
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(tick, tickInterval);
    stateLabel.textContent = 'Playing';
    updateHUD();
    draw();
}
startBtn.addEventListener('click', startGame);
playerNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') startBtn.click(); });
playAgain.addEventListener('click', () => { gameOverOverlay.classList.add('hidden'); startOverlay.classList.remove('hidden'); });
toLeaderboard.addEventListener('click', () => { gameOverOverlay.classList.add('hidden'); showLeaderboard(); });
viewLB.addEventListener('click', showLeaderboard);
closeLB.addEventListener('click', () => { leaderboardOverlay.classList.add('hidden'); startOverlay.classList.remove('hidden'); });
function handleDirectionButton(dir) {
    if (dir === 'up') setDirection(0, -1);
    if (dir === 'down') setDirection(0, 1);
    if (dir === 'left') setDirection(-1, 0);
    if (dir === 'right') setDirection(1, 0);
}
dpad.addEventListener('pointerdown', (ev) => {
    const btn = ev.target.closest('button[data-dir]');
    if (!btn) return;
    ev.preventDefault();
    const dir = btn.getAttribute('data-dir');
    handleDirectionButton(dir);
});
dpad.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-dir]');
    if (!btn) return;
    const dir = btn.getAttribute('data-dir');
    handleDirectionButton(dir);
});
tapBtn.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    if (!running) {
        if (!playerNameInput.value && !playerName) { playerNameInput.focus(); return; }
        startGame();
    }
});
tapBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    if (!running) {
        if (!playerNameInput.value && !playerName) { playerNameInput.focus(); return; }
        startGame();
    }
});
let touchStart = null;
canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        const t = e.touches[0];
        touchStart = { x: t.clientX, y: t.clientY, t: Date.now() };
    }
}, { passive: true });
canvas.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;
    const minDist = 24;
    if (Math.hypot(dx, dy) < minDist) return;
    if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) setDirection(1, 0); else setDirection(-1, 0);
    } else {
        if (dy > 0) setDirection(0, 1); else setDirection(0, -1);
    }
}, { passive: true });
function renderLoop() { draw(); requestAnimationFrame(renderLoop); }
requestAnimationFrame(renderLoop);
function showLeaderboard() { renderLeaderboard(); leaderboardOverlay.classList.remove('hidden'); startOverlay.classList.add('hidden'); gameOverOverlay.classList.add('hidden'); }
let adminInputVisible = false;
function showAdminInput() {
    adminInputVisible = true;
    adminInputWrap.classList.remove('hidden');
    adminInputWrap.setAttribute('aria-hidden', 'false');
    adminCodeInput.value = '';
    adminCodeInput.focus();
    adminHint.classList.remove('hidden');
    pauseGameAndHide();
    clearTimeout(adminInputWrap._timeout);
    adminInputWrap._timeout = setTimeout(hideAdminInput, 12000);
}
function hideAdminInput() {
    adminInputVisible = false;
    adminInputWrap.classList.add('hidden');
    adminInputWrap.setAttribute('aria-hidden', 'true');
    adminHint.classList.add('hidden');
    clearTimeout(adminInputWrap._timeout);
    adminInputWrap._timeout = null;
    resumeGameAndShow();
}
window.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
        return;
    }

    if (e.ctrlKey && (e.key === '`' || e.code === 'Backquote')) {
        e.preventDefault();
        showAdminInput();
    }
});
adminCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hideAdminInput(); return; }
    if (e.key === 'Enter') {
        const val = (adminCodeInput.value || '').trim().toLowerCase();
        hideAdminInput();
        if (val === SECRET_WORD.toLowerCase()) {
            adminPasswordPanel.classList.remove('hidden');
            adminPasswordPanel.setAttribute('aria-hidden', 'false');
            adminPasswordInput.value = '';
            adminPasswordInput.focus();
            pauseGameAndHide();
        } else {
            alert('Secret word incorrect.');
            resumeGameAndShow();
        }
    } else {
        clearTimeout(adminInputWrap._timeout);
        adminInputWrap._timeout = setTimeout(hideAdminInput, 12000);
    }
});
adminCodeCancel.addEventListener('click', () => { hideAdminInput(); });
adminPasswordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { adminPasswordPanel.classList.add('hidden'); adminPasswordPanel.setAttribute('aria-hidden', 'true'); resumeGameAndShow(); return; }
    if (e.key === 'Enter') { adminPasswordSubmit.click(); }
});
adminPasswordCancel.addEventListener('click', () => {
    adminPasswordPanel.classList.add('hidden');
    adminPasswordPanel.setAttribute('aria-hidden', 'true');
    resumeGameAndShow();
});
adminPasswordSubmit.addEventListener('click', () => {
    const pwd = (adminPasswordInput.value || '').trim();
    adminPasswordPanel.classList.add('hidden');
    adminPasswordPanel.setAttribute('aria-hidden', 'true');
    if (pwd === ADMIN_PASSWORD) {
        adminOverlay.classList.remove('hidden');
        adminHint.classList.add('hidden');
        pauseGameAndHide();
    } else {
        alert('Incorrect password.');
        resumeGameAndShow();
    }
});
adminClear.addEventListener('click', async () => {
    const ok = await showConfirm({
        title: 'Clear leaderboard',
        message: 'Clear leaderboard permanently? This cannot be undone.',
        okText: 'Clear',
        cancelText: 'Cancel'
    });

    if (!ok) return;

    writeLeaderboard([]);
    renderLeaderboard();
    adminOverlay.classList.add('hidden');
    showToast('Leaderboard cleared.');
    resumeGameAndShow();
});

function showConfirm({ title = 'Confirm action', message = 'Are you sure?', okText = 'OK', cancelText = 'Cancel' } = {}) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleEl = modal.querySelector('#confirmTitle');
        const descEl = modal.querySelector('#confirmDesc');
        const okBtn = modal.querySelector('#confirmOk');
        const cancelBtn = modal.querySelector('#confirmCancel');

        titleEl.textContent = title;
        descEl.textContent = message;
        okBtn.textContent = okText;
        cancelBtn.textContent = cancelText;

        modal.classList.remove('hidden');

        const previouslyFocused = document.activeElement;
        okBtn.focus();

        function cleanup(result) {
            modal.classList.add('hidden');
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            document.removeEventListener('keydown', onKey);
            if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
            resolve(result);
        }

        function onOk(e) { e.preventDefault(); cleanup(true); }
        function onCancel(e) { e.preventDefault(); cleanup(false); }
        function onKey(e) {
            if (e.key === 'Escape') cleanup(false);
            if (e.key === 'Enter') cleanup(true);
        }

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        document.addEventListener('keydown', onKey);
    });
}

function showToast(text, ms = 1800) {
    const t = document.getElementById('toast');
    t.textContent = text;
    t.classList.remove('hidden');
    clearTimeout(t._timeout);
    t._timeout = setTimeout(() => {
        t.classList.add('hidden');
    }, ms);
}

adminClose.addEventListener('click', () => { adminOverlay.classList.add('hidden'); startOverlay.classList.remove('hidden'); resumeGameAndShow(); });
window.addEventListener('keydown', (e) => {
    if (isAnyOverlayOrInputActive()) return;
    if (!running && (e.key === ' ' || e.key === 'Enter')) {
        if (startOverlay.classList.contains('hidden')) {
            if (playerName) startGame();
        } else {
            startBtn.click();
        }
    }
    if (e.key === 'ArrowUp') setDirection(0, -1);
    if (e.key === 'ArrowDown') setDirection(0, 1);
    if (e.key === 'ArrowLeft') setDirection(-1, 0);
    if (e.key === 'ArrowRight') setDirection(1, 0);
});
if (playerName) { playerNameInput.value = playerName; stateLabel.textContent = 'Tap to start'; } else { stateLabel.textContent = 'Enter name to start'; }
resetGame();
draw();
window._illusionGame = { resetGame, submitScore, readLeaderboard, renderLeaderboard, showAdminInput };
