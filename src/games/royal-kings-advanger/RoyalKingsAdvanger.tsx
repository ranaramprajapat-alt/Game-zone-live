import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Crown, Pause, Play, RotateCcw, Volume2, VolumeX, ArrowLeft, Scroll, Sparkles } from "lucide-react";
import { navigate } from "@/src/lib/router";

interface RoyalKingsAdvangerProps {
  initialKingName?: string;
}

export default function RoyalKingsAdvanger({ initialKingName = "RANA" }: RoyalKingsAdvangerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);

  // UI state
  const [kingName, setKingName] = useState(initialKingName || "RANA");
  const [draftName, setDraftName] = useState(initialKingName || "RANA");
  const [gameStarted, setGameStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [levelComplete, setLevelComplete] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Game Stats
  const [level, setLevel] = useState(1);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [targetCoins, setTargetCoins] = useState(5);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [nearMushroom, setNearMushroom] = useState(false);

  // AI Wisdom state
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Refs for animation loop & state accessible inside animation callbacks
  const animFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gameRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    clock: THREE.Clock;
    player: THREE.Group;
    playerVelocity: THREE.Vector3;
    cameraAngle: { x: number; y: number };
    keys: Record<string, boolean>;
    jumpsCount: number;
    isJumping: boolean;
    mushrooms: { mesh: THREE.Group; radius: number; height: number }[];
    coins: { mesh: THREE.Group; collected: boolean }[];
    enemies: { mesh: THREE.Group; alive: boolean; speed: number; aura?: THREE.Mesh }[];
    buildings: { mesh: THREE.Group; size: number }[];
    foliage: { mesh: THREE.Group; radius: number }[];
    currentMushroom: { mesh: THREE.Group; radius: number; height: number } | null;
    joystick: { active: boolean; startX: number; startY: number; moveX: number; moveY: number };
    lookTouch: { active: boolean; lastX: number; lastY: number };
    level: number;
    coinsCollected: number;
    targetCoins: number;
    timeRemaining: number;
    gameStarted: boolean;
    isPaused: boolean;
    gameOver: boolean;
    levelComplete: boolean;
    soundEnabled: boolean;
  }>({} as any);

  // --- AUDIO SFX ENGINE ---
  const playSound = (f: number, type: OscillatorType, d: number, v = 0.1, sweep = 0) => {
    if (!gameRef.current.soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
      const ctx = audioCtxRef.current;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, ctx.currentTime);
      if (sweep > 0) o.frequency.exponentialRampToValueAtTime(sweep, ctx.currentTime + d);
      g.gain.setValueAtTime(v, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + d);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + d);
    } catch {
      // Audio fallback
    }
  };

  const SFX = {
    coin: () => {
      playSound(880, "sine", 0.1, 0.1, 1320);
      setTimeout(() => playSound(1320, "sine", 0.2, 0.1), 50);
    },
    jump: () => playSound(200, "triangle", 0.2, 0.1, 600),
    doubleJump: () => {
      playSound(300, "triangle", 0.2, 0.1, 800);
      setTimeout(() => playSound(450, "sine", 0.1, 0.05), 50);
    },
    stomp: () => playSound(150, "sawtooth", 0.1, 0.15, 50),
    defeat: () => {
      playSound(300, "sawtooth", 0.5, 0.2, 50);
      setTimeout(() => playSound(200, "sawtooth", 0.5, 0.2, 40), 200);
    },
    victory: () => [523, 659, 783, 1046].forEach((n, i) => setTimeout(() => playSound(n, "square", 0.3, 0.05), i * 150)),
  };

  // --- INITIALIZE THREE.JS GAME ---
  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || window.innerHeight;

    // 1. Scene
    const scene = new THREE.Scene();

    // Gradient Sky Canvas Texture
    const skyCanvas = document.createElement("canvas");
    skyCanvas.width = 512;
    skyCanvas.height = 512;
    const skyCtx = skyCanvas.getContext("2d");
    if (skyCtx) {
      const skyGradient = skyCtx.createLinearGradient(0, 0, 0, 512);
      skyGradient.addColorStop(0, "#1a237e");
      skyGradient.addColorStop(0.3, "#4fc3f7");
      skyGradient.addColorStop(0.6, "#81d4fa");
      skyGradient.addColorStop(0.8, "#ffcc80");
      skyGradient.addColorStop(1, "#ff8a65");
      skyCtx.fillStyle = skyGradient;
      skyCtx.fillRect(0, 0, 512, 512);
    }
    const skyTexture = new THREE.CanvasTexture(skyCanvas);
    scene.background = skyTexture;
    scene.fog = new THREE.FogExp2(0x88ccff, 0.002);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 2000);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: window.devicePixelRatio < 2,
      powerPreference: "high-performance",
      stencil: false,
      depth: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    containerRef.current.appendChild(renderer.domElement);

    // 4. Lights
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

    // 5. Ground Texture & Mesh
    const groundCanvas = document.createElement("canvas");
    groundCanvas.width = 512;
    groundCanvas.height = 512;
    const groundCtx = groundCanvas.getContext("2d");
    if (groundCtx) {
      const groundGradient = groundCtx.createRadialGradient(256, 256, 0, 256, 256, 256);
      groundGradient.addColorStop(0, "#4caf50");
      groundGradient.addColorStop(0.5, "#388e3c");
      groundGradient.addColorStop(1, "#2e7d32");
      groundCtx.fillStyle = groundGradient;
      groundCtx.fillRect(0, 0, 512, 512);

      groundCtx.fillStyle = "rgba(46, 125, 50, 0.3)";
      for (let i = 0; i < 2000; i++) {
        groundCtx.fillRect(Math.random() * 512, Math.random() * 512, 2, 4);
      }
    }
    const groundTexture = new THREE.CanvasTexture(groundCanvas);
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(50, 50);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(1000, 64),
      new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 0.9, metalness: 0.0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Stone Road
    const roadCanvas = document.createElement("canvas");
    roadCanvas.width = 64;
    roadCanvas.height = 256;
    const roadCtx = roadCanvas.getContext("2d");
    if (roadCtx) {
      roadCtx.fillStyle = "#8d6e63";
      roadCtx.fillRect(0, 0, 64, 256);
      roadCtx.fillStyle = "#795548";
      for (let y = 0; y < 256; y += 20) {
        for (let x = 0; x < 64; x += 15) {
          const offset = (Math.floor(y / 20) % 2) * 7;
          roadCtx.fillRect(x + offset, y, 13, 18);
        }
      }
    }
    const roadTexture = new THREE.CanvasTexture(roadCanvas);
    roadTexture.wrapS = THREE.RepeatWrapping;
    roadTexture.wrapT = THREE.RepeatWrapping;
    roadTexture.repeat.set(1, 100);

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 2000),
      new THREE.MeshStandardMaterial({ map: roadTexture, roughness: 0.8, metalness: 0.1 })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.02;
    road.receiveShadow = true;
    scene.add(road);

    // 6. Player Creation
    const playerGroup = new THREE.Group();
    const robeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.1 });

    // Capsule helper
    const capsule = new THREE.Group();
    const cMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.5, 16), robeMat);
    cMesh.castShadow = true;
    const tMesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), robeMat);
    tMesh.position.y = 0.25;
    tMesh.castShadow = true;
    const bMesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), robeMat);
    bMesh.position.y = -0.25;
    bMesh.castShadow = true;
    capsule.add(cMesh, tMesh, bMesh);
    capsule.position.y = 1;
    playerGroup.add(capsule);

    const trimMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.3, metalness: 0.7 });
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 16), trimMat);
    trim.position.y = 0.5;
    trim.rotation.x = Math.PI / 2;
    playerGroup.add(trim);

    const skinMat = new THREE.MeshStandardMaterial({ color: 0x8d5524, roughness: 0.7, metalness: 0.0 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 20), skinMat);
    head.position.y = 1.9;
    head.castShadow = true;
    playerGroup.add(head);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), skinMat);
    nose.position.set(0, 1.88, 0.38);
    playerGroup.add(nose);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    const eL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), eyeMat);
    eL.position.set(-0.14, 2.0, 0.32);
    playerGroup.add(eL);
    const eR = eL.clone();
    eR.position.x = 0.14;
    playerGroup.add(eR);

    // Pagdi / Royal Turban
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

    playerGroup.add(pagdi);
    playerGroup.castShadow = true;
    scene.add(playerGroup);

    // Save initial game reference object
    const gState = {
      scene,
      camera,
      renderer,
      clock: new THREE.Clock(),
      player: playerGroup,
      playerVelocity: new THREE.Vector3(),
      cameraAngle: { x: 0, y: 0.3 },
      keys: {},
      jumpsCount: 0,
      isJumping: false,
      mushrooms: [],
      coins: [],
      enemies: [],
      buildings: [],
      foliage: [],
      currentMushroom: null,
      joystick: { active: false, startX: 0, startY: 0, moveX: 0, moveY: 0 },
      lookTouch: { active: false, lastX: 0, lastY: 0 },
      level: 1,
      coinsCollected: 0,
      targetCoins: 5,
      timeRemaining: 60,
      gameStarted: false,
      isPaused: false,
      gameOver: false,
      levelComplete: false,
      soundEnabled: true,
    };
    gameRef.current = gState;

    // Mouse / Window input event handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameRef.current.gameStarted || gameRef.current.isPaused) return;
      if (e.code === "Space") {
        doJump();
      } else if (e.code === "KeyP") {
        togglePauseRef.current();
      } else {
        gameRef.current.keys[e.code] = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") {
        gameRef.current.keys[e.code] = false;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!gameRef.current.gameStarted || gameRef.current.isPaused) return;
      if (document.pointerLockElement === renderer.domElement) {
        gameRef.current.cameraAngle.x -= e.movementX * 0.002;
        gameRef.current.cameraAngle.y = Math.max(-0.8, Math.min(0.8, gameRef.current.cameraAngle.y - e.movementY * 0.002));
      }
    };

    const handleCanvasClick = () => {
      if (gameRef.current.gameStarted && !gameRef.current.isPaused && !("ontouchstart" in window)) {
        renderer.domElement.requestPointerLock();
      }
    };

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth || window.innerWidth;
      const h = containerRef.current.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    document.addEventListener("mousemove", handleMouseMove);
    renderer.domElement.addEventListener("click", handleCanvasClick);
    window.addEventListener("resize", handleResize);

    // Animation loop definition
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = Math.min(gameRef.current.clock.getDelta(), 0.1);
      const time = Date.now() * 0.001;

      if (gameRef.current.gameStarted && !gameRef.current.isPaused && !gameRef.current.gameOver && !gameRef.current.levelComplete) {
        // Update Time
        gameRef.current.timeRemaining -= delta;
        setTimeRemaining(Math.max(0, Math.ceil(gameRef.current.timeRemaining)));

        if (gameRef.current.timeRemaining <= 0) {
          triggerGameOverInternal();
        }

        // Player physics & movement
        let mx = 0, mz = 0;
        if (gameRef.current.keys["KeyW"]) mz -= 1;
        if (gameRef.current.keys["KeyS"]) mz += 1;
        if (gameRef.current.keys["KeyA"]) mx -= 1;
        if (gameRef.current.keys["KeyD"]) mx += 1;
        if (gameRef.current.joystick.active) {
          mx = gameRef.current.joystick.moveX;
          mz = gameRef.current.joystick.moveY;
        }

        const dir = new THREE.Vector3(mx, 0, mz);
        if (dir.length() > 0.1) {
          dir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), gameRef.current.cameraAngle.x);
          gameRef.current.playerVelocity.x += dir.x * 0.1;
          gameRef.current.playerVelocity.z += dir.z * 0.1;
          gameRef.current.player.rotation.y = THREE.MathUtils.lerp(
            gameRef.current.player.rotation.y,
            Math.atan2(dir.x, dir.z),
            0.2
          );
        }

        gameRef.current.playerVelocity.y += -0.015; // Gravity
        const oldPos = gameRef.current.player.position.clone();

        gameRef.current.player.position.x += gameRef.current.playerVelocity.x;
        if (gameRef.current.buildings.some((b) => Math.abs(gameRef.current.player.position.x - b.mesh.position.x) < b.size && Math.abs(gameRef.current.player.position.z - b.mesh.position.z) < b.size)) {
          gameRef.current.player.position.x = oldPos.x;
        }

        gameRef.current.player.position.z += gameRef.current.playerVelocity.z;
        if (gameRef.current.buildings.some((b) => Math.abs(gameRef.current.player.position.x - b.mesh.position.x) < b.size && Math.abs(gameRef.current.player.position.z - b.mesh.position.z) < b.size)) {
          gameRef.current.player.position.z = oldPos.z;
        }

        gameRef.current.player.position.y += gameRef.current.playerVelocity.y;
        gameRef.current.playerVelocity.x *= 0.82;
        gameRef.current.playerVelocity.z *= 0.82;

        if (gameRef.current.player.position.y <= 0) {
          gameRef.current.player.position.y = 0;
          gameRef.current.playerVelocity.y = 0;
          gameRef.current.isJumping = false;
          gameRef.current.jumpsCount = 0;
        }

        // Mushroom platforms collision
        gameRef.current.mushrooms.forEach((m) => {
          const d = new THREE.Vector2(gameRef.current.player.position.x - m.mesh.position.x, gameRef.current.player.position.z - m.mesh.position.z).length();
          if (d < m.radius && gameRef.current.player.position.y >= m.height - 1 && gameRef.current.playerVelocity.y <= 0) {
            gameRef.current.player.position.y = m.height;
            gameRef.current.playerVelocity.y = 0;
            gameRef.current.isJumping = false;
            gameRef.current.jumpsCount = 0;
          }
        });

        // Near mushroom check for Sage Advice button
        const foundMushroom = gameRef.current.mushrooms.find(
          (m) => new THREE.Vector2(gameRef.current.player.position.x - m.mesh.position.x, gameRef.current.player.position.z - m.mesh.position.z).length() < m.radius && Math.abs(gameRef.current.player.position.y - m.height) < 0.5
        );
        if (foundMushroom !== gameRef.current.currentMushroom) {
          gameRef.current.currentMushroom = foundMushroom || null;
          setNearMushroom(!!foundMushroom);
        }

        // Enemies chase & stomp
        gameRef.current.enemies.forEach((e) => {
          if (!e.alive) return;
          const d = gameRef.current.player.position.distanceTo(e.mesh.position);
          if (d < 30) {
            const chaseDir = gameRef.current.player.position.clone().sub(e.mesh.position).normalize();
            e.mesh.position.x += chaseDir.x * e.speed;
            e.mesh.position.z += chaseDir.z * e.speed;
            e.mesh.lookAt(gameRef.current.player.position.x, 0, gameRef.current.player.position.z);
          }
          if (d < 1.6) {
            if (gameRef.current.player.position.y > e.mesh.position.y + 0.6 && gameRef.current.playerVelocity.y < 0) {
              e.alive = false;
              e.mesh.scale.y = 0.1;
              gameRef.current.playerVelocity.y = 0.3;
              SFX.stomp();
              setTimeout(() => (e.mesh.visible = false), 500);
            } else {
              triggerGameOverInternal();
            }
          }
        });

        // Coins collection
        gameRef.current.coins.forEach((c) => {
          if (!c.collected && gameRef.current.player.position.distanceTo(c.mesh.position) < 2) {
            c.collected = true;
            c.mesh.visible = false;
            gameRef.current.coinsCollected += 1;
            setCoinsCollected(gameRef.current.coinsCollected);
            SFX.coin();
            if (gameRef.current.coinsCollected >= gameRef.current.targetCoins) {
              gameRef.current.levelComplete = true;
              setLevelComplete(true);
              SFX.victory();
            }
          }
        });

        // Rotate coins
        gameRef.current.coins.forEach((c) => {
          if (!c.collected) c.mesh.rotation.y += 0.04;
        });

        // Aura pulse on enemies
        const pulse = 1 + Math.sin(time * 3) * 0.12;
        gameRef.current.enemies.forEach((e) => {
          if (e.alive && e.aura) e.aura.scale.setScalar(pulse);
        });

        // Camera follow
        const offset = new THREE.Vector3(
          Math.sin(gameRef.current.cameraAngle.x) * 15,
          6 + gameRef.current.cameraAngle.y * 10,
          Math.cos(gameRef.current.cameraAngle.x) * 15
        );
        camera.position.lerp(gameRef.current.player.position.clone().add(offset), 0.08);
        camera.lookAt(gameRef.current.player.position.x, gameRef.current.player.position.y + 1.5, gameRef.current.player.position.z);

        // Minimap render
        renderMinimap();
      } else if (!gameRef.current.gameStarted) {
        // Menu ambient camera rotation
        const t = time * 0.3;
        camera.position.set(Math.sin(t) * 80, 35 + Math.sin(t * 0.5) * 5, Math.cos(t) * 80);
        camera.lookAt(0, 8, 0);
      }

      renderer.render(scene, camera);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    // Cleanup on unmount
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("mousemove", handleMouseMove);
      renderer.domElement.removeEventListener("click", handleCanvasClick);
      window.removeEventListener("resize", handleResize);

      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      scene.clear();
    };
  }, []);

  // Sync state values to ref
  useEffect(() => {
    gameRef.current.gameStarted = gameStarted;
    gameRef.current.isPaused = isPaused;
    gameRef.current.gameOver = gameOver;
    gameRef.current.levelComplete = levelComplete;
    gameRef.current.soundEnabled = soundEnabled;
  }, [gameStarted, isPaused, gameOver, levelComplete, soundEnabled]);

  const togglePauseRef = useRef<() => void>(() => {});
  togglePauseRef.current = () => {
    if (!gameRef.current.gameStarted) return;
    const nextPaused = !gameRef.current.isPaused;
    gameRef.current.isPaused = nextPaused;
    setIsPaused(nextPaused);
    if (!nextPaused && !("ontouchstart" in window)) {
      gameRef.current.renderer.domElement.requestPointerLock();
    }
  };

  const triggerGameOverInternal = () => {
    gameRef.current.gameOver = true;
    setGameOver(true);
    SFX.defeat();
  };

  const doJump = () => {
    if (gameRef.current.jumpsCount < 2) {
      if (gameRef.current.jumpsCount === 0) {
        gameRef.current.playerVelocity.y = 0.35;
        SFX.jump();
      } else {
        gameRef.current.playerVelocity.y = 0.48;
        SFX.doubleJump();
      }
      gameRef.current.isJumping = true;
      gameRef.current.jumpsCount += 1;
    }
  };

  // Level Setup
  const setupLevel = (targetLevel: number) => {
    const scene = gameRef.current.scene;
    // Clear old objects
    [gameRef.current.mushrooms, gameRef.current.coins, gameRef.current.enemies, gameRef.current.buildings, gameRef.current.foliage].forEach((arr) =>
      arr.forEach((o) => scene.remove(o.mesh || (o as any)))
    );
    gameRef.current.mushrooms = [];
    gameRef.current.coins = [];
    gameRef.current.enemies = [];
    gameRef.current.buildings = [];
    gameRef.current.foliage = [];

    const newTargetCoins = 5 + (targetLevel - 1) * 2;
    const newTime = Math.max(30, 60 - (targetLevel - 1) * 3);

    gameRef.current.level = targetLevel;
    gameRef.current.coinsCollected = 0;
    gameRef.current.targetCoins = newTargetCoins;
    gameRef.current.timeRemaining = newTime;
    gameRef.current.gameOver = false;
    gameRef.current.levelComplete = false;
    gameRef.current.isPaused = false;

    setLevel(targetLevel);
    setCoinsCollected(0);
    setTargetCoins(newTargetCoins);
    setTimeRemaining(newTime);
    setGameOver(false);
    setLevelComplete(false);
    setIsPaused(false);

    // Create Houses & Trees
    for (let i = 0; i < 30; i++) {
      const s = i % 2 === 0 ? 1 : -1;
      createHouse(s * (40 + Math.random() * 200), (i - 15) * 60, s > 0 ? -Math.PI / 2 : Math.PI / 2);
      createTree(s * (25 + Math.random() * 200), (i - 15) * 60 + 25);
    }

    // Create Mushrooms
    for (let i = 0; i < 60; i++) {
      createMushroom(Math.random() * 600 - 300, Math.random() * 600 - 300);
    }

    // Create Coins
    for (let i = 0; i < newTargetCoins + 10; i++) {
      let x = Math.random() * 600 - 300,
        z = Math.random() * 600 - 300,
        y = 1.2;
      if (Math.random() > 0.8 && gameRef.current.mushrooms.length) {
        const m = gameRef.current.mushrooms[Math.floor(Math.random() * gameRef.current.mushrooms.length)];
        x = m.mesh.position.x;
        z = m.mesh.position.z;
        y = m.height + 1.2;
      }
      createCoin(x, y, z);
    }

    // Create Enemies
    for (let i = 0; i < 5 + targetLevel; i++) {
      createEnemy(Math.random() * 600 - 300, 0, Math.random() * 600 - 300, targetLevel);
    }

    // Reset player position
    gameRef.current.player.position.set(0, 0, 10);
    gameRef.current.playerVelocity.set(0, 0, 0);
    gameRef.current.jumpsCount = 0;
    gameRef.current.isJumping = false;
  };

  const createHouse = (x: number, z: number, r: number) => {
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

    g.position.set(x, 0, z);
    g.rotation.y = r;
    gameRef.current.scene.add(g);
    gameRef.current.buildings.push({ mesh: g, size: 5.5 });
  };

  const createTree = (x: number, z: number) => {
    const g = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 4), trunkMat);
    t.position.y = 2;
    t.castShadow = true;
    g.add(t);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.8 });
    const l1 = new THREE.Mesh(new THREE.SphereGeometry(2, 12, 12), leafMat);
    l1.position.y = 4.5;
    l1.castShadow = true;
    g.add(l1);

    const scale = 0.8 + Math.random() * 0.6;
    g.scale.set(scale, scale, scale);
    g.position.set(x, 0, z);
    gameRef.current.scene.add(g);
    gameRef.current.foliage.push({ mesh: g, radius: 0.7 * scale });
  };

  const createMushroom = (x: number, z: number) => {
    const g = new THREE.Group();
    const s = 0.8 + Math.random() * 2;

    const stemMat = new THREE.MeshStandardMaterial({ color: 0xfaf8ef, roughness: 0.7 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 4, 8), stemMat);
    stem.position.y = 2;
    stem.castShadow = true;
    g.add(stem);

    const hue = 0.02 + Math.random() * 0.12;
    const capColor = new THREE.Color().setHSL(hue, 0.85, 0.5);
    const capMat = new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.3, metalness: 0.1, emissive: capColor, emissiveIntensity: 0.15 });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(2.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
    cap.position.y = 4;
    cap.scale.y = 0.55;
    cap.castShadow = true;
    g.add(cap);

    g.position.set(x, 0, z);
    g.scale.set(s, s, s);
    gameRef.current.scene.add(g);
    gameRef.current.mushrooms.push({ mesh: g, radius: 2.5 * s, height: 4 * s });
  };

  const createCoin = (x: number, y: number, z: number) => {
    const g = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1.0, roughness: 0.1, emissive: 0xffaa00, emissiveIntensity: 0.6 });
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 12), goldMat);
    coin.rotation.x = Math.PI / 2;
    g.add(coin);
    g.position.set(x, y, z);
    gameRef.current.scene.add(g);
    gameRef.current.coins.push({ mesh: g, collected: false });
  };

  const createEnemy = (x: number, y: number, z: number, targetLevel: number) => {
    const g = new THREE.Group();
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, metalness: 0.9, roughness: 0.2, emissive: 0x110011, emissiveIntensity: 0.2 });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2, 6), darkMat);
    body.position.y = 1;
    body.castShadow = true;
    g.add(body);

    const visorMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
    const visor = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.12), visorMat);
    visor.position.set(0, 2.35, 0.32);
    g.add(visor);

    const auraMat = new THREE.MeshBasicMaterial({ color: 0x220022, transparent: true, opacity: 0.25 });
    const aura = new THREE.Mesh(new THREE.SphereGeometry(1.2, 6, 6), auraMat);
    aura.position.y = 1.5;
    g.add(aura);

    g.position.set(x, y, z);
    gameRef.current.scene.add(g);
    gameRef.current.enemies.push({ mesh: g, alive: true, speed: 0.05 + targetLevel * 0.012, aura });
  };

  // Render Minimap
  const renderMinimap = () => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, 180, 180);
    const px = gameRef.current.player.position.x;
    const pz = gameRef.current.player.position.z;
    const scale = 1.0;
    const rotation = gameRef.current.cameraAngle.x;

    ctx.save();
    ctx.translate(90, 90);

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.arc(0, 0, 85, 0, Math.PI * 2);
    ctx.fill();
    ctx.clip();

    ctx.rotate(rotation);

    const getX = (wx: number) => (wx - px) * scale;
    const getY = (wz: number) => (wz - pz) * scale;

    gameRef.current.mushrooms.forEach((m) => {
      ctx.fillStyle = "rgba(255, 105, 180, 0.75)";
      ctx.beginPath();
      ctx.arc(getX(m.mesh.position.x), getY(m.mesh.position.z), 2.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    });

    gameRef.current.coins.forEach((c) => {
      if (!c.collected) {
        ctx.fillStyle = "#ffd700";
        ctx.beginPath();
        ctx.arc(getX(c.mesh.position.x), getY(c.mesh.position.z), 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    gameRef.current.enemies.forEach((e) => {
      if (e.alive) {
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(getX(e.mesh.position.x), getY(e.mesh.position.z), 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.restore();

    // Player marker on minimap
    ctx.save();
    ctx.translate(90, 90);
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(-4, -3);
    ctx.lineTo(4, -3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // AI Wisdom & Lore feature
  const fetchAiDecree = async () => {
    setAiLoading(true);
    setAiText("Consulting royal archives & sage scrolls...");
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyCUfBukV_pFlfkof0ASlGEy1FKc9ANnZD0", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Generate a short epic royal decree for King ${kingName} reclaiming level ${level} gold.` }] }]
        })
      });
      const data = await response.json();
      const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text || `By royal decree, King ${kingName} shall reclaim every piece of gold in kingdom level ${level}!`;
      setAiText(txt);
    } catch {
      setAiText(`By royal decree, King ${kingName} shall reclaim every piece of gold in kingdom level ${level}!`);
    } finally {
      setAiLoading(false);
    }
  };

  const fetchSageAdvice = async () => {
    setAiLoading(true);
    setAiText("The Mushroom Sage is whispering advice...");
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyCUfBukV_pFlfkof0ASlGEy1FKc9ANnZD0", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Give a wise 1-sentence game advice for King ${kingName} standing atop a magic mushroom.` }] }]
        })
      });
      const data = await response.json();
      const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text || `King ${kingName}, leap high from the cap to outsmart the shadow crawlers!`;
      setAiText(txt);
    } catch {
      setAiText(`King ${kingName}, leap high from the cap to outsmart the shadow crawlers!`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleStartGame = () => {
    const finalName = draftName.trim().toUpperCase() || "RANA";
    setKingName(finalName);
    gameRef.current.gameStarted = true;
    setGameStarted(true);
    setupLevel(1);
  };

  return (
    <div className="relative w-full h-[var(--app-height)] lg:h-screen bg-slate-950 overflow-hidden select-none font-sans text-white">
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* START SCREEN OVERLAY */}
      {!gameStarted && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-purple-950/90 via-slate-950/95 to-black p-6 backdrop-blur-md">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-400 shadow-2xl shadow-amber-500/20 mb-2">
              <Crown size={42} />
            </div>

            <h1 className="text-4xl lg:text-5xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500 drop-shadow-[0_4px_20px_rgba(245,158,11,0.5)]">
              ROYAL KING'S<br />ADVANGER
            </h1>
            <p className="text-sm lg:text-base text-slate-300 font-medium tracking-wide">
              Reclaim the lost treasury of your ancestors in 3D.
            </p>

            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl backdrop-blur-xl shadow-xl space-y-3">
              <label className="block text-xs font-black uppercase tracking-widest text-cyan-400">
                The Proclamation of King
              </label>
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value.toUpperCase())}
                maxLength={12}
                placeholder="YOUR NAME"
                className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl px-4 py-3 text-center text-xl font-black uppercase text-amber-400 tracking-wider outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleStartGame}
                className="w-full py-4 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 rounded-2xl font-black text-lg tracking-widest uppercase hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-amber-500/20"
              >
                Start Adventure
              </button>

              <button
                onClick={() => navigate("/")}
                className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-2xl font-bold text-sm transition-colors"
              >
                <ArrowLeft size={16} /> Back to Games
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-GAME HUD UI */}
      {gameStarted && (
        <>
          {/* Top Left Stats */}
          <div className="absolute top-4 left-4 z-40 space-y-2 pointer-events-auto">
            <div className="bg-slate-900/80 border border-slate-700/60 backdrop-blur-md px-4 py-2 rounded-2xl shadow-lg flex items-center gap-2">
              <Crown size={18} className="text-amber-400" />
              <span className="font-black text-sm text-slate-200 tracking-wide">KING: {kingName}</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-700/60 backdrop-blur-md px-4 py-2 rounded-2xl shadow-lg flex items-center gap-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Level</span>
                <div className="font-black text-amber-400 text-base">{level}</div>
              </div>
              <div className="border-l border-slate-700 pl-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Gold Coins</span>
                <div className="font-black text-yellow-400 text-base">🪙 {coinsCollected} / {targetCoins}</div>
              </div>
              <div className="border-l border-slate-700 pl-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Timer</span>
                <div className={`font-black text-base ${timeRemaining <= 10 ? "text-red-500 animate-pulse" : "text-cyan-400"}`}>
                  ⏳ {timeRemaining}s
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => togglePauseRef.current()}
                className="bg-slate-900/80 hover:bg-slate-800 border border-slate-700 backdrop-blur-md px-4 py-2 rounded-2xl text-xs font-black tracking-wider uppercase flex items-center gap-2 transition-colors"
              >
                {isPaused ? <Play size={14} /> : <Pause size={14} />} {isPaused ? "Resume" : "Pause"}
              </button>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="bg-slate-900/80 hover:bg-slate-800 border border-slate-700 backdrop-blur-md px-3 py-2 rounded-2xl transition-colors text-slate-300"
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              <button
                onClick={() => navigate("/")}
                className="bg-slate-900/80 hover:bg-slate-800 border border-slate-700 backdrop-blur-md px-3 py-2 rounded-2xl transition-colors text-slate-300"
                title="Exit Game"
              >
                <ArrowLeft size={16} />
              </button>
            </div>
          </div>

          {/* Minimap (Top Right) */}
          <div className="absolute top-4 right-4 z-40 w-36 h-36 lg:w-44 lg:h-44 bg-slate-900/80 border-2 border-slate-700/80 rounded-full overflow-hidden shadow-2xl backdrop-blur-md">
            <canvas ref={minimapCanvasRef} width={180} height={180} className="w-full h-full" />
          </div>

          {/* AI Controls (Right side below minimap) */}
          <div className="absolute top-48 right-4 z-40 flex flex-col gap-2 pointer-events-auto">
            <button
              onClick={fetchAiDecree}
              className="bg-slate-900/80 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 px-4 py-2.5 rounded-2xl text-xs font-black tracking-wider uppercase backdrop-blur-md flex items-center gap-2 transition-all shadow-lg"
            >
              <Scroll size={16} /> Decree
            </button>
            {nearMushroom && (
              <button
                onClick={fetchSageAdvice}
                className="bg-slate-900/80 hover:bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 px-4 py-2.5 rounded-2xl text-xs font-black tracking-wider uppercase backdrop-blur-md flex items-center gap-2 transition-all shadow-lg animate-bounce"
              >
                <Sparkles size={16} /> Sage Advice
              </button>
            )}
          </div>

          {/* AI Text Speech Box */}
          {aiText && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 max-w-lg w-11/12 bg-slate-900/90 border border-amber-500/40 p-4 rounded-3xl backdrop-blur-xl shadow-2xl text-center space-y-2 pointer-events-auto">
              <p className="text-xs font-black text-amber-400 uppercase tracking-widest">Royal Decree / Sage Advice</p>
              <p className="text-sm font-medium text-slate-200">{aiLoading ? "Consulting..." : aiText}</p>
              <button
                onClick={() => setAiText(null)}
                className="text-[10px] font-black uppercase text-slate-500 hover:text-slate-300 tracking-wider pt-1"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Controls hint */}
          <div className="hidden lg:block absolute bottom-4 left-4 z-30 bg-slate-900/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-800 text-[11px] text-slate-400 font-medium">
            <span className="font-black text-slate-200">WASD</span> Move • <span className="font-black text-slate-200">SPACE</span> Jump / Double Jump • <span className="font-black text-slate-200">MOUSE</span> Look Around • <span className="font-black text-slate-200">P</span> Pause
          </div>
        </>
      )}

      {/* PAUSE SCREEN */}
      {isPaused && gameStarted && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md p-6">
          <div className="max-w-sm w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center space-y-5 shadow-2xl">
            <h2 className="text-3xl font-black tracking-widest text-amber-400">GAME PAUSED</h2>
            <p className="text-sm text-slate-400">Take a royal rest, Sire.</p>
            <div className="space-y-3">
              <button
                onClick={() => togglePauseRef.current()}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-2xl font-black text-sm tracking-wider uppercase transition-colors shadow-lg shadow-amber-500/20"
              >
                Resume Game
              </button>
              <button
                onClick={() => navigate("/")}
                className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-black text-sm tracking-wider uppercase transition-colors"
              >
                Exit to Games
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEVEL COMPLETE SCREEN */}
      {levelComplete && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-emerald-950/90 backdrop-blur-md p-6">
          <div className="max-w-sm w-full bg-slate-900 border border-emerald-500/40 p-8 rounded-3xl text-center space-y-5 shadow-2xl">
            <div className="text-5xl animate-bounce">🏆</div>
            <h2 className="text-3xl font-black tracking-widest text-emerald-400">VICTORY!</h2>
            <p className="text-sm text-slate-300">The royal treasury is secure for Level {level}.</p>
            <button
              onClick={() => setupLevel(level + 1)}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl font-black text-sm tracking-wider uppercase transition-colors shadow-lg shadow-emerald-500/20"
            >
              Next Level
            </button>
          </div>
        </div>
      )}

      {/* GAME OVER SCREEN */}
      {gameOver && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-950/90 backdrop-blur-md p-6">
          <div className="max-w-sm w-full bg-slate-900 border border-red-500/40 p-8 rounded-3xl text-center space-y-5 shadow-2xl">
            <h2 className="text-3xl font-black tracking-widest text-red-400">RECLAIM FAILED</h2>
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400 uppercase font-black">Gold Harvested</span>
              <div className="text-2xl font-black text-amber-400 mt-1">🪙 {coinsCollected}</div>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => setupLevel(level)}
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-red-500 hover:bg-red-400 text-white rounded-2xl font-black text-sm tracking-wider uppercase transition-colors shadow-lg shadow-red-500/20"
              >
                <RotateCcw size={16} /> Retry Level
              </button>
              <button
                onClick={() => navigate("/")}
                className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-black text-sm tracking-wider uppercase transition-colors"
              >
                Back to Games
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
