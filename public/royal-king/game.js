// Royal King's Advanger - Game Engine

const apiKey = "AIzaSyCUfBukV_pFlfkof0ASlGEy1FKc9ANnZD0";
let kingName = "RANA";

// --- BACKGROUND IMAGE GENERATION ---
async function fetchBackground() {
    const prompt = "Cinematic 4K widescreen video game menu background for 'Royal Adventure'. A beautiful green kingdom meadow at sunset with giant stylized red mushrooms. Golden coins sparkle in the air. In the foreground, a king with a white robe and saffron turban is viewed from behind, looking out at the horizon. Stylized 3D art style, epic fantasy, vibrant lighting, highly detailed.";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;
    const loaderContainer = document.getElementById('img-loading-indicator');
    const startScreen = document.getElementById('start-screen');

    for (let i = 0; i < 5; i++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instances: { prompt: prompt }, parameters: { sampleCount: 1 } })
            });
            const result = await response.json();
            if (result.predictions && result.predictions[0]) {
                const b64 = result.predictions[0].bytesBase64Encoded;
                startScreen.style.backgroundImage = `linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.6) 100%), url(data:image/png;base64,${b64})`;
                loaderContainer.style.display = 'none';
                return;
            }
        } catch (e) {
            await new Promise(res => setTimeout(res, Math.pow(2, i) * 1000));
        }
    }
    loaderContainer.querySelector('.loading-text-small').innerText = "Vision cloud over the kingdom.";
}

// --- SOUND ENGINE ---
let audioCtx = null;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

const SFX = {
    play: (f, t, d, v = 0.1, s = 0) => {
        if (!audioCtx) return;
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = t;
        o.frequency.setValueAtTime(f, audioCtx.currentTime);
        if (s > 0) o.frequency.exponentialRampToValueAtTime(s, audioCtx.currentTime + d);
        g.gain.setValueAtTime(v, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + d);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(); o.stop(audioCtx.currentTime + d);
    },
    coin: () => { SFX.play(880, 'sine', 0.1, 0.1, 1320); setTimeout(() => SFX.play(1320, 'sine', 0.2, 0.1), 50); },
    jump: () => SFX.play(200, 'triangle', 0.2, 0.1, 600),
    doubleJump: () => { SFX.play(300, 'triangle', 0.2, 0.1, 800); setTimeout(() => SFX.play(450, 'sine', 0.1, 0.05), 50); },
    stomp: () => SFX.play(150, 'sawtooth', 0.1, 0.15, 50),
    defeat: () => { SFX.play(300, 'sawtooth', 0.5, 0.2, 50); setTimeout(() => SFX.play(200, 'sawtooth', 0.5, 0.2, 40), 200); },
    victory: () => [523, 659, 783, 1046].forEach((n, i) => setTimeout(() => SFX.play(n, 'square', 0.3, 0.05), i * 150))
};

// --- GEMINI AI ---
async function callGemini(prompt, isTTS = false) {
    const url = isTTS ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}` : `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    const payload = isTTS ? {
        contents: [{ parts: [{ text: `Speak to King ${kingName}: ${prompt}` }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Algieba" } } } }
    } : {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: `You are the Sage Advisor to KING ${kingName}. Address him as Your Majesty or King ${kingName}. Keep responses poetic and under 30 words.` }] }
    };
    for (let i = 0; i < 5; i++) {
        try {
            const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            return await r.json();
        } catch (e) { await new Promise(res => setTimeout(res, Math.pow(2, i) * 1000)); }
    }
}

async function playTTS(text) {
    try {
        const res = await callGemini(text, true);
        const pcm = res.candidates[0].content.parts[0].inlineData.data;
        const wav = pcmToWav(pcm);
        new Audio(URL.createObjectURL(wav)).play();
    } catch (e) { }
}

function pcmToWav(b64, sr = 24000) {
    const s = atob(b64), len = s.length, buf = new ArrayBuffer(44 + len), view = new DataView(buf);
    const w = (o, str) => { for (let i = 0; i < str.length; i++) view.setUint8(o + i, str.charCodeAt(i)); };
    w(0, 'RIFF'); view.setUint32(4, 36 + len, true); w(8, 'WAVE'); w(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sr, true); view.setUint32(28, sr * 2, true); view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); w(36, 'data'); view.setUint32(40, len, true);
    for (let i = 0; i < len; i++) view.setUint8(44 + i, s.charCodeAt(i));
    return new Blob([buf], { type: 'audio/wav' });
}

async function generateWorldLore() {
    const overlay = document.getElementById('ai-overlay'), textDiv = document.getElementById('ai-text');
    overlay.style.display = 'block'; textDiv.innerText = 'Consulting royal archives...';
    const res = await callGemini(`The treasury of King ${kingName} is empty. Reclaim gold for Level ${scores.level}.`);
    textDiv.innerText = res.candidates?.[0]?.content?.parts?.[0]?.text || `The King must prevail.`;
    setTimeout(() => { if (!currentMushroom) overlay.style.display = 'none'; }, 8000);
}

async function getMushroomWisdom() {
    const overlay = document.getElementById('ai-overlay'), textDiv = document.getElementById('ai-text');
    overlay.style.display = 'block'; textDiv.innerText = 'The Sage speaks...';
    const res = await callGemini("Advice for King " + kingName + " on reclaiming gold and defeating shadow crawlers.");
    const t = res.candidates?.[0]?.content?.parts?.[0]?.text || "Move with royal grace.";
    textDiv.innerText = t; playTTS(t);
}

// --- GAME ENGINE ---
const CONFIG = {
    gravity: -0.015, jumpForce: 0.35, doubleJumpForce: 0.48, moveSpeed: 0.1, maxSpeed: 0.5, friction: 0.82,
    baseMushroomCount: 60, worldSize: 600, baseLevelTime: 60, minimapZoom: 1.0
};

let scene, camera, renderer, clock, player, playerVelocity = new THREE.Vector3();
let isJumping = false, jumpsCount = 0, isGameStarted = false, isPaused = false, currentMushroom = null;
let mushrooms = [], coins = [], enemies = [], buildings = [], foliage = [];
let scores = { level: 1, coinsCollectedInLevel: 0, targetCoins: 5, timeRemaining: 60 };
let keys = {}, cameraAngle = { x: 0, y: 0.3 };
let mapCanvas, mapCtx;

let joystick = { active: false, startX: 0, startY: 0, moveX: 0, moveY: 0 };
let lookTouch = { active: false, lastX: 0, lastY: 0 };

window.onload = () => {
    init(); animate();
    fetchBackground();
};

function init() {
    scene = new THREE.Scene();

    // Create gradient sky background
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 512;
    skyCanvas.height = 512;
    const skyCtx = skyCanvas.getContext('2d');
    const skyGradient = skyCtx.createLinearGradient(0, 0, 0, 512);
    skyGradient.addColorStop(0, '#1a237e');
    skyGradient.addColorStop(0.3, '#4fc3f7');
    skyGradient.addColorStop(0.6, '#81d4fa');
    skyGradient.addColorStop(0.8, '#ffcc80');
    skyGradient.addColorStop(1, '#ff8a65');
    skyCtx.fillStyle = skyGradient;
    skyCtx.fillRect(0, 0, 512, 512);

    const skyTexture = new THREE.CanvasTexture(skyCanvas);
    scene.background = skyTexture;
    scene.fog = new THREE.FogExp2(0x88ccff, 0.002);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);

    renderer = new THREE.WebGLRenderer({
        antialias: window.devicePixelRatio < 2,
        powerPreference: "high-performance",
        stencil: false,
        depth: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    document.getElementById('game-canvas').appendChild(renderer.domElement);

    mapCanvas = document.getElementById('minimap-canvas');
    mapCtx = mapCanvas.getContext('2d');

    // Enhanced lighting setup
    const ambientLight = new THREE.AmbientLight(0x8899aa, 0.4);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x228b22, 0.6);
    hemiLight.position.set(0, 100, 0);
    scene.add(hemiLight);

    const sun = new THREE.DirectionalLight(0xfff4e5, 1.5);
    sun.position.set(200, 350, -100);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.left = -500;
    sun.shadow.camera.right = 500;
    sun.shadow.camera.top = 500;
    sun.shadow.camera.bottom = -500;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 1000;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);

    const rimLight = new THREE.DirectionalLight(0xff9966, 0.4);
    rimLight.position.set(-100, 50, 100);
    scene.add(rimLight);

    // Enhanced ground with gradient texture
    const groundCanvas = document.createElement('canvas');
    groundCanvas.width = 512;
    groundCanvas.height = 512;
    const groundCtx = groundCanvas.getContext('2d');
    const groundGradient = groundCtx.createRadialGradient(256, 256, 0, 256, 256, 256);
    groundGradient.addColorStop(0, '#4caf50');
    groundGradient.addColorStop(0.5, '#388e3c');
    groundGradient.addColorStop(1, '#2e7d32');
    groundCtx.fillStyle = groundGradient;
    groundCtx.fillRect(0, 0, 512, 512);

    groundCtx.fillStyle = 'rgba(46, 125, 50, 0.3)';
    for (let i = 0; i < 2000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        groundCtx.fillRect(x, y, 2, 4);
    }

    const groundTexture = new THREE.CanvasTexture(groundCanvas);
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(50, 50);

    const ground = new THREE.Mesh(
        new THREE.CircleGeometry(1000, 64),
        new THREE.MeshStandardMaterial({
            map: groundTexture,
            roughness: 0.9,
            metalness: 0.0
        })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Enhanced road with stone texture
    const roadCanvas = document.createElement('canvas');
    roadCanvas.width = 64;
    roadCanvas.height = 256;
    const roadCtx = roadCanvas.getContext('2d');
    roadCtx.fillStyle = '#8d6e63';
    roadCtx.fillRect(0, 0, 64, 256);
    roadCtx.fillStyle = '#795548';
    for (let y = 0; y < 256; y += 20) {
        for (let x = 0; x < 64; x += 15) {
            const offset = (Math.floor(y / 20) % 2) * 7;
            roadCtx.fillRect(x + offset, y, 13, 18);
        }
    }
    roadCtx.strokeStyle = '#5d4037';
    roadCtx.lineWidth = 1;
    for (let y = 0; y < 256; y += 20) {
        for (let x = 0; x < 64; x += 15) {
            const offset = (Math.floor(y / 20) % 2) * 7;
            roadCtx.strokeRect(x + offset, y, 13, 18);
        }
    }

    const roadTexture = new THREE.CanvasTexture(roadCanvas);
    roadTexture.wrapS = THREE.RepeatWrapping;
    roadTexture.wrapT = THREE.RepeatWrapping;
    roadTexture.repeat.set(1, 100);

    const road = new THREE.Mesh(
        new THREE.PlaneGeometry(15, 2000),
        new THREE.MeshStandardMaterial({
            map: roadTexture,
            roughness: 0.8,
            metalness: 0.1
        })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.02;
    road.receiveShadow = true;
    scene.add(road);

    createPlayer();
    setupInput();

    document.getElementById('btn-start').onclick = startGame;
    document.getElementById('btn-resume').onclick = togglePause;
    document.getElementById('btn-next').onclick = nextLevel;
    document.getElementById('btn-retry').onclick = retryLevel;
    document.getElementById('jump-btn').ontouchstart = (e) => { e.preventDefault(); doJump(); };

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    clock = new THREE.Clock();
    document.getElementById('vignette').style.display = 'block';
}

function setupInput() {
    window.addEventListener('keydown', e => {
        if (e.code === 'Space') doJump();
        else if (e.code === 'KeyP' && isGameStarted) togglePause();
        else keys[e.code] = true;
    });
    window.addEventListener('keyup', e => { if (e.code !== 'Space') keys[e.code] = false; });

    const canvas = renderer.domElement;
    canvas.addEventListener('mousedown', () => { if (isGameStarted && !isPaused && !('ontouchstart' in window)) canvas.requestPointerLock(); });

    document.addEventListener('mousemove', e => {
        if (!isGameStarted || isPaused || document.pointerLockElement !== canvas) return;
        cameraAngle.x -= e.movementX * 0.002;
        cameraAngle.y = Math.max(-0.8, Math.min(0.8, cameraAngle.y - e.movementY * 0.002));
    });

    canvas.addEventListener('touchstart', e => {
        if (!isGameStarted || isPaused) return;
        const touch = e.touches[0];
        if (touch.clientX > window.innerWidth / 2) {
            lookTouch.active = true; lookTouch.lastX = touch.clientX; lookTouch.lastY = touch.clientY;
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
        if (!lookTouch.active) return;
        const touch = e.touches[0];
        const dx = touch.clientX - lookTouch.lastX;
        const dy = touch.clientY - lookTouch.lastY;
        cameraAngle.x -= dx * 0.005;
        cameraAngle.y = Math.max(-0.8, Math.min(0.8, cameraAngle.y - dy * 0.005));
        lookTouch.lastX = touch.clientX; lookTouch.lastY = touch.clientY;
    }, { passive: false });

    canvas.addEventListener('touchend', () => lookTouch.active = false);

    const joyBase = document.getElementById('joystick-base'), joyHandle = document.getElementById('joystick-handle');
    joyBase.addEventListener('touchstart', e => {
        e.preventDefault(); joystick.active = true;
        const r = joyBase.getBoundingClientRect();
        joystick.startX = r.left + r.width / 2; joystick.startY = r.top + r.height / 2;
    });
    window.addEventListener('touchmove', e => {
        if (!joystick.active) return;
        const touch = Array.from(e.touches).find(t => t.target === joyBase || joyBase.contains(t.target));
        if (!touch) return;
        let dx = touch.clientX - joystick.startX, dy = touch.clientY - joystick.startY;
        const dist = Math.sqrt(dx * dx + dy * dy), max = 60;
        if (dist > max) { dx *= max / dist; dy *= max / dist; }
        joyHandle.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        joystick.moveX = dx / max; joystick.moveY = dy / max;
    }, { passive: false });
    window.addEventListener('touchend', () => {
        joystick.active = false; joystick.moveX = 0; joystick.moveY = 0;
        joyHandle.style.transform = `translate(-50%, -50%)`;
    });
}

function startGame() {
    const input = document.getElementById('king-name-input');
    kingName = input.value.trim().toUpperCase() || "RANA";
    document.getElementById('king-name-display').innerText = `KING: ${kingName}`;
    initAudio();
    isGameStarted = true; isPaused = false;
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('ui').style.display = 'block';
    document.getElementById('minimap-container').style.display = 'block';
    document.getElementById('ai-controls').style.display = 'flex';
    if ('ontouchstart' in window) document.getElementById('mobile-controls').style.display = 'block';
    setupLevel();
}

function setupLevel() {
    [mushrooms, coins, enemies, buildings, foliage].forEach(arr => arr.forEach(o => scene.remove(o.mesh || o)));
    mushrooms = []; coins = []; enemies = []; buildings = []; foliage = [];
    scores.coinsCollectedInLevel = 0;
    scores.targetCoins = 5 + (scores.level - 1) * 2;
    scores.timeRemaining = Math.max(30, CONFIG.baseLevelTime - (scores.level - 1) * 3);
    document.getElementById('level-display').innerText = `LEVEL: ${scores.level}`;
    updateCoinUI();
    for (let i = 0; i < 30; i++) {
        const s = i % 2 === 0 ? 1 : -1;
        createHouse(s * (40 + Math.random() * 200), (i - 15) * 60, s > 0 ? -Math.PI / 2 : Math.PI / 2);
        createTree(s * (25 + Math.random() * 200), (i - 15) * 60 + 25);
    }
    for (let i = 0; i < CONFIG.baseMushroomCount; i++) createMushroom(Math.random() * CONFIG.worldSize - CONFIG.worldSize / 2, Math.random() * CONFIG.worldSize - CONFIG.worldSize / 2);
    for (let i = 0; i < scores.targetCoins + 10; i++) {
        let x = Math.random() * CONFIG.worldSize - CONFIG.worldSize / 2, z = Math.random() * CONFIG.worldSize - CONFIG.worldSize / 2, y = 1.2;
        if (Math.random() > 0.8 && mushrooms.length) {
            const m = mushrooms[Math.floor(Math.random() * mushrooms.length)];
            x = m.mesh.position.x; z = m.mesh.position.z; y = m.height + 1.2;
        }
        createCoin(x, y, z);
    }
    for (let i = 0; i < 5 + scores.level; i++) createEnemy(Math.random() * CONFIG.worldSize - CONFIG.worldSize / 2, 0, Math.random() * CONFIG.worldSize - CONFIG.worldSize / 2);
    player.position.set(0, 0, 10); playerVelocity.set(0, 0, 0); jumpsCount = 0; isJumping = false;
}

function createHouse(x, z, r) {
    const g = new THREE.Group();

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.8, metalness: 0.1 });
    const w = new THREE.Mesh(new THREE.BoxGeometry(10, 7, 10), wallMat);
    w.position.y = 3.5;
    w.castShadow = true;
    w.receiveShadow = true;
    g.add(w);

    const doorMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.7 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 0.3), doorMat);
    door.position.set(0, 2, 5.1);
    g.add(door);

    const windowMat = new THREE.MeshStandardMaterial({ color: 0x87ceeb, roughness: 0.2, metalness: 0.5, emissive: 0xffcc66, emissiveIntensity: 0.2 });
    const window1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 0.3), windowMat);
    window1.position.set(-3, 4, 5.1);
    g.add(window1);
    const window2 = window1.clone();
    window2.position.x = 3;
    g.add(window2);

    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.7, metalness: 0.2 });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(8.5, 6, 4), roofMat);
    roof.position.y = 9.5;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(roof);

    const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3, 1.5), new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.9 }));
    chimney.position.set(3, 10, 0);
    chimney.castShadow = true;
    g.add(chimney);

    g.position.set(x, 0, z);
    g.rotation.y = r;
    scene.add(g);
    buildings.push({ mesh: g, size: 5.5 });
}

function createTree(x, z) {
    const g = new THREE.Group();

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9, metalness: 0.0 });
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 4), trunkMat);
    t.position.y = 2;
    t.castShadow = true;
    t.receiveShadow = true;
    g.add(t);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.8, metalness: 0.0 });

    const l1 = new THREE.Mesh(new THREE.SphereGeometry(2, 12, 12), leafMat);
    l1.position.y = 4.5;
    l1.castShadow = true;
    g.add(l1);

    const l2 = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 10), leafMat);
    l2.position.set(0.8, 5.5, 0.5);
    l2.castShadow = true;
    g.add(l2);

    const l3 = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 10), leafMat);
    l3.position.set(-0.6, 5.8, -0.4);
    l3.castShadow = true;
    g.add(l3);

    const scale = 0.8 + Math.random() * 0.6;
    g.scale.set(scale, scale, scale);

    g.position.set(x, 0, z);
    scene.add(g);
    foliage.push({ mesh: g, radius: 0.7 * scale });
}

function createMushroom(x, z) {
    const g = new THREE.Group();
    const s = 0.8 + Math.random() * 2;

    const stemMat = new THREE.MeshStandardMaterial({ color: 0xfaf8ef, roughness: 0.7, metalness: 0.0 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 4, 8), stemMat);
    stem.position.y = 2;
    stem.castShadow = true;
    g.add(stem);

    const ringMat = new THREE.MeshStandardMaterial({ color: 0xeee8d5, roughness: 0.8 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.1, 6, 12), ringMat);
    ring.position.y = 3.2;
    ring.rotation.x = Math.PI / 2;
    g.add(ring);

    const hue = 0.02 + Math.random() * 0.12;
    const capColor = new THREE.Color().setHSL(hue, 0.85, 0.5);
    const capMat = new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.3, metalness: 0.1, emissive: capColor, emissiveIntensity: 0.15 });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(2.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
    cap.position.y = 4;
    cap.scale.y = 0.55;
    cap.castShadow = true;
    g.add(cap);

    const spotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.0 });
    for (let i = 0; i < 5; i++) {
        const spot = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 6), spotMat);
        const angle = (i / 5) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 1.2 + Math.random() * 0.8;
        spot.position.set(Math.cos(angle) * dist, 4.2, Math.sin(angle) * dist);
        spot.scale.y = 0.5;
        g.add(spot);
    }

    g.position.set(x, 0, z);
    g.scale.set(s, s, s);
    scene.add(g);
    mushrooms.push({ mesh: g, radius: 2.5 * s, height: 4 * s });
}

function createCoin(x, y, z) {
    const g = new THREE.Group();

    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1.0, roughness: 0.1, emissive: 0xffaa00, emissiveIntensity: 0.6 });
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 12), goldMat);
    coin.rotation.x = Math.PI / 2;
    g.add(coin);

    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 32;
    glowCanvas.height = 32;
    const glowCtx = glowCanvas.getContext('2d');
    const gradient = glowCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 215, 0, 0.7)');
    gradient.addColorStop(0.5, 'rgba(255, 180, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 150, 0, 0)');
    glowCtx.fillStyle = gradient;
    glowCtx.fillRect(0, 0, 32, 32);

    const glowTexture = new THREE.CanvasTexture(glowCanvas);
    const glowMaterial = new THREE.SpriteMaterial({ map: glowTexture, transparent: true, blending: THREE.AdditiveBlending });
    const glowSprite = new THREE.Sprite(glowMaterial);
    glowSprite.scale.set(2.5, 2.5, 1);
    g.add(glowSprite);

    g.position.set(x, y, z);
    scene.add(g);
    coins.push({ mesh: g, collected: false });
}

function createEnemy(x, y, z) {
    const group = new THREE.Group();

    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, metalness: 0.9, roughness: 0.2, emissive: 0x110011, emissiveIntensity: 0.2 });

    const body = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2, 6), darkMat);
    body.position.y = 1;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), darkMat);
    head.position.y = 2.3;
    head.rotation.y = Math.PI / 4;
    group.add(head);

    const visorMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
    const visor = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.12), visorMat);
    visor.position.set(0, 2.35, 0.32);
    group.add(visor);

    const auraMat = new THREE.MeshBasicMaterial({ color: 0x220022, transparent: true, opacity: 0.25 });
    const aura = new THREE.Mesh(new THREE.SphereGeometry(1.2, 6, 6), auraMat);
    aura.position.y = 1.5;
    group.add(aura);

    group.position.set(x, y, z);
    scene.add(group);
    enemies.push({ mesh: group, alive: true, speed: 0.05 + scores.level * 0.012, aura: aura });
}

function createCapsule(r, h, mat) {
    const g = new THREE.Group();
    const ch = h - 2 * r;

    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, ch, 16), mat);
    c.castShadow = true;

    const t = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    t.position.y = ch / 2;
    t.castShadow = true;

    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat);
    b.position.y = -ch / 2;
    b.castShadow = true;

    g.add(c, t, b);
    return g;
}

function createPlayer() {
    player = new THREE.Group();

    const robeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.1 });
    const torso = createCapsule(0.4, 1.3, robeMat);
    torso.position.y = 1;
    player.add(torso);

    const trimMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.3, metalness: 0.7 });
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 16), trimMat);
    trim.position.y = 0.5;
    trim.rotation.x = Math.PI / 2;
    player.add(trim);

    const skinMat = new THREE.MeshStandardMaterial({ color: 0x8d5524, roughness: 0.7, metalness: 0.0 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 20), skinMat);
    head.position.y = 1.9;
    head.castShadow = true;
    player.add(head);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), skinMat);
    nose.position.set(0, 1.88, 0.38);
    player.add(nose);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    const eL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), eyeMat);
    eL.position.set(-0.14, 2.0, 0.32);
    player.add(eL);

    const eR = eL.clone();
    eR.position.x = 0.14;
    player.add(eR);

    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const shineL = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), shineMat);
    shineL.position.set(-0.12, 2.02, 0.36);
    player.add(shineL);
    const shineR = shineL.clone();
    shineR.position.x = 0.16;
    player.add(shineR);

    const pagdi = new THREE.Group();
    const turbanMat = new THREE.MeshStandardMaterial({ color: 0xff9933, roughness: 0.5, metalness: 0.2 });

    for (let i = 0; i < 5; i++) {
        const w = new THREE.Mesh(new THREE.TorusGeometry(0.38 - i * 0.02, 0.1), turbanMat);
        w.rotation.x = Math.PI / 2 + (i - 2) * 0.18;
        w.position.y = 2.12 + i * 0.07;
        w.scale.y = 0.5;
        w.castShadow = true;
        pagdi.add(w);
    }

    const jewelMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.1, metalness: 0.8, emissive: 0x660000, emissiveIntensity: 0.3 });
    const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), jewelMat);
    jewel.position.set(0, 2.45, 0.25);
    jewel.rotation.z = Math.PI / 4;
    pagdi.add(jewel);

    const jewelLight = new THREE.PointLight(0xff3333, 0.5, 2);
    jewelLight.position.copy(jewel.position);
    pagdi.add(jewelLight);

    player.add(pagdi);
    player.castShadow = true;
    scene.add(player);
}

function drawMinimap() {
    mapCtx.clearRect(0, 0, 200, 200);
    const px = player.position.x, pz = player.position.z, scale = CONFIG.minimapZoom;
    const rotation = cameraAngle.x;

    mapCtx.save();
    mapCtx.translate(100, 100);

    mapCtx.fillStyle = "rgba(15, 23, 42, 0.85)";
    mapCtx.beginPath();
    mapCtx.arc(0, 0, 95, 0, Math.PI * 2);
    mapCtx.fill();
    mapCtx.clip();

    mapCtx.rotate(rotation);

    const getX = (wx, wz) => (wx - px) * scale;
    const getY = (wx, wz) => (wz - pz) * scale;

    buildings.forEach(b => {
        const bx = getX(b.mesh.position.x, b.mesh.position.z);
        const bz = getY(b.mesh.position.x, b.mesh.position.z);
        mapCtx.fillStyle = "rgba(139, 90, 43, 0.6)";
        mapCtx.fillRect(bx - b.size * scale, bz - b.size * scale, b.size * 2 * scale, b.size * 2 * scale);
    });

    foliage.forEach(t => {
        mapCtx.fillStyle = "rgba(34, 139, 34, 0.7)";
        mapCtx.beginPath();
        mapCtx.arc(getX(t.mesh.position.x, t.mesh.position.z), getY(t.mesh.position.x, t.mesh.position.z), t.radius * 3 * scale, 0, Math.PI * 2);
        mapCtx.fill();
    });

    mushrooms.forEach(m => {
        mapCtx.fillStyle = "rgba(255, 105, 180, 0.75)";
        mapCtx.beginPath();
        mapCtx.arc(getX(m.mesh.position.x, m.mesh.position.z), getY(m.mesh.position.x, m.mesh.position.z), 2.5 * scale, 0, Math.PI * 2);
        mapCtx.fill();
    });

    coins.forEach(c => {
        if (!c.collected) {
            mapCtx.fillStyle = "#ffd700";
            mapCtx.beginPath();
            mapCtx.arc(getX(c.mesh.position.x, c.mesh.position.z), getY(c.mesh.position.x, c.mesh.position.z), 4, 0, Math.PI * 2);
            mapCtx.fill();
        }
    });

    enemies.forEach(e => {
        if (e.alive) {
            mapCtx.fillStyle = "#ef4444";
            mapCtx.beginPath();
            mapCtx.arc(getX(e.mesh.position.x, e.mesh.position.z), getY(e.mesh.position.x, e.mesh.position.z), 5, 0, Math.PI * 2);
            mapCtx.fill();
        }
    });

    mapCtx.restore();

    mapCtx.save();
    mapCtx.translate(100, 100);

    mapCtx.fillStyle = "#22d3ee";
    mapCtx.beginPath();
    mapCtx.arc(0, 0, 7, 0, Math.PI * 2);
    mapCtx.fill();

    mapCtx.fillStyle = "#ffffff";
    mapCtx.beginPath();
    mapCtx.moveTo(0, -16);
    mapCtx.lineTo(-5, -4);
    mapCtx.lineTo(5, -4);
    mapCtx.closePath();
    mapCtx.fill();

    mapCtx.strokeStyle = "#0f172a";
    mapCtx.lineWidth = 1.5;
    mapCtx.stroke();

    mapCtx.restore();
}

function updateCoinUI() { document.getElementById('coin-goal').innerText = `🪙 ${scores.coinsCollectedInLevel} / ${scores.targetCoins}`; }
function doJump() { if (jumpsCount < 2) { if (jumpsCount === 0) { playerVelocity.y = CONFIG.jumpForce; SFX.jump(); } else { playerVelocity.y = CONFIG.doubleJumpForce; SFX.doubleJump(); } isJumping = true; jumpsCount++; } }
function triggerGameOver() { isPaused = true; SFX.defeat(); document.getElementById('game-over-screen').style.display = 'flex'; document.getElementById('go-result').innerText = `Gold Harvested: ${scores.coinsCollectedInLevel}`; }
function togglePause() { if (!isGameStarted) return; isPaused = !isPaused; document.getElementById('pause-screen').style.display = isPaused ? 'flex' : 'none'; if (!isPaused && !('ontouchstart' in window)) renderer.domElement.requestPointerLock(); }
function retryLevel() { document.getElementById('game-over-screen').style.display = 'none'; isPaused = false; setupLevel(); }
function nextLevel() { scores.level++; document.getElementById('level-complete-screen').style.display = 'none'; isPaused = false; setupLevel(); }

function updatePlayer(delta) {
    if (!isGameStarted || isPaused || scores.timeRemaining <= 0) return;
    let mx = 0, mz = 0;
    if (keys['KeyW']) mz -= 1; if (keys['KeyS']) mz += 1;
    if (keys['KeyA']) mx -= 1; if (keys['KeyD']) mx += 1;
    if (joystick.active) { mx = joystick.moveX; mz = joystick.moveY; }
    const dir = new THREE.Vector3(mx, 0, mz);
    if (dir.length() > 0.1) {
        dir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngle.x);
        playerVelocity.x += dir.x * CONFIG.moveSpeed; playerVelocity.z += dir.z * CONFIG.moveSpeed;
        player.rotation.y = THREE.MathUtils.lerp(player.rotation.y, Math.atan2(dir.x, dir.z), 0.2);
    }
    playerVelocity.y += CONFIG.gravity;
    const old = player.position.clone();
    player.position.x += playerVelocity.x;
    if (buildings.some(b => Math.abs(player.position.x - b.mesh.position.x) < b.size && Math.abs(player.position.z - b.mesh.position.z) < b.size)) player.position.x = old.x;
    player.position.z += playerVelocity.z;
    if (buildings.some(b => Math.abs(player.position.x - b.mesh.position.x) < b.size && Math.abs(player.position.z - b.mesh.position.z) < b.size)) player.position.z = old.z;
    player.position.y += playerVelocity.y;
    playerVelocity.x *= CONFIG.friction; playerVelocity.z *= CONFIG.friction;
    if (player.position.y <= 0) { player.position.y = 0; playerVelocity.y = 0; isJumping = false; jumpsCount = 0; }
    mushrooms.forEach(m => {
        const d = new THREE.Vector2(player.position.x - m.mesh.position.x, player.position.z - m.mesh.position.z).length();
        if (d < m.radius && player.position.y >= m.height - 1 && playerVelocity.y <= 0) { player.position.y = m.height; playerVelocity.y = 0; isJumping = false; jumpsCount = 0; }
    });
    enemies.forEach(e => {
        if (!e.alive) return;
        const d = player.position.distanceTo(e.mesh.position);
        if (d < 30) { const m = player.position.clone().sub(e.mesh.position).normalize(); e.mesh.position.x += m.x * e.speed; e.mesh.position.z += m.z * e.speed; e.mesh.lookAt(player.position.x, 0, player.position.z); }
        if (d < 1.6) {
            if (player.position.y > e.mesh.position.y + 0.6 && playerVelocity.y < 0) { e.alive = false; e.mesh.scale.y = 0.1; playerVelocity.y = 0.3; SFX.stomp(); setTimeout(() => e.mesh.visible = false, 500); }
            else triggerGameOver();
        }
    });
    coins.forEach(c => {
        if (!c.collected && player.position.distanceTo(c.mesh.position) < 2) {
            c.collected = true;
            c.mesh.visible = false;
            scores.coinsCollectedInLevel++;
            SFX.coin();
            updateCoinUI();
            showCoinFlash();
            if (scores.coinsCollectedInLevel >= scores.targetCoins) {
                document.getElementById('level-complete-screen').style.display = 'flex';
                SFX.victory();
                togglePause();
            }
        }
    });
    const found = mushrooms.find(m => new THREE.Vector2(player.position.x - m.mesh.position.x, player.position.z - m.mesh.position.z).length() < m.radius && Math.abs(player.position.y - m.height) < 0.5);
    if (found !== currentMushroom) { currentMushroom = found; document.getElementById('btn-wisdom').style.display = currentMushroom ? 'flex' : 'none'; }
}

function showCoinFlash() {
    const flash = document.createElement('div');
    flash.className = 'coin-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 300);
}

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);
    const time = Date.now() * 0.001;

    updatePlayer(delta);

    if (isGameStarted && !isPaused && scores.timeRemaining > 0 &&
        document.getElementById('level-complete-screen').style.display !== 'flex' &&
        document.getElementById('game-over-screen').style.display !== 'flex') {

        scores.timeRemaining -= delta;
        const tEl = document.getElementById('timer-display');
        tEl.innerText = `⏳ ${Math.max(0, Math.ceil(scores.timeRemaining))}s`;
        if (scores.timeRemaining <= 10) tEl.classList.add('timer-warning');
        if (scores.timeRemaining <= 0) triggerGameOver('time');

        coins.forEach(c => {
            if (!c.collected) {
                c.mesh.rotation.y += 0.04;
            }
        });

        const pulse = 1 + Math.sin(time * 3) * 0.12;
        enemies.forEach(e => {
            if (e.alive && e.aura) {
                e.aura.scale.setScalar(pulse);
            }
        });

        const offset = new THREE.Vector3(
            Math.sin(cameraAngle.x) * 15,
            6 + cameraAngle.y * 10,
            Math.cos(cameraAngle.x) * 15
        );
        camera.position.lerp(player.position.clone().add(offset), 0.08);
        camera.lookAt(player.position.x, player.position.y + 1.5, player.position.z);

        drawMinimap();

    } else if (!isGameStarted) {
        const t = time * 0.3;
        camera.position.set(Math.sin(t) * 80, 35 + Math.sin(t * 0.5) * 5, Math.cos(t) * 80);
        camera.lookAt(0, 8, 0);
    }

    renderer.render(scene, camera);
}
