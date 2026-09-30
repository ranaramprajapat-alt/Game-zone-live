/**
 * Sound effects for SketchGuess using Web Audio API
 * No external files needed — all sounds are generated programmatically.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    // Resume if suspended (browser autoplay policy)
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    return audioCtx;
}

function playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = "sine",
    volume: number = 0.3,
    delay: number = 0
) {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime + delay);
    gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
}

// --- Sound Effects ---

/** Happy chime when someone guesses correctly */
export function playCorrectGuess() {
    playTone(523, 0.15, "sine", 0.25, 0);      // C5
    playTone(659, 0.15, "sine", 0.25, 0.1);    // E5
    playTone(784, 0.25, "sine", 0.3, 0.2);     // G5
}

/** Your own correct guess — more celebratory */
export function playMyCorrectGuess() {
    playTone(523, 0.12, "sine", 0.25, 0);      // C5
    playTone(659, 0.12, "sine", 0.25, 0.08);   // E5
    playTone(784, 0.12, "sine", 0.25, 0.16);   // G5
    playTone(1047, 0.3, "sine", 0.3, 0.24);    // C6
}

/** Round start notification */
export function playRoundStart() {
    playTone(440, 0.1, "triangle", 0.2, 0);     // A4
    playTone(554, 0.1, "triangle", 0.2, 0.1);   // C#5
    playTone(659, 0.15, "triangle", 0.25, 0.2);  // E5
}

/** Timer warning — plays when timer is low (≤10s) */
export function playTimerTick() {
    playTone(800, 0.08, "square", 0.08, 0);
}

/** Urgent tick for last 5 seconds */
export function playTimerUrgent() {
    playTone(1000, 0.06, "square", 0.12, 0);
    playTone(1000, 0.06, "square", 0.12, 0.12);
}

/** Round ended — descending tone */
export function playRoundEnd() {
    playTone(659, 0.15, "sine", 0.2, 0);       // E5
    playTone(523, 0.15, "sine", 0.2, 0.12);    // C5
    playTone(392, 0.25, "sine", 0.25, 0.24);   // G4
}

/** Player joined the room */
export function playPlayerJoin() {
    playTone(600, 0.12, "sine", 0.15, 0);
    playTone(800, 0.15, "sine", 0.18, 0.08);
}

/** New chat message pop */
export function playMessagePop() {
    playTone(1200, 0.06, "sine", 0.08, 0);
}

/** Word chosen / selection made */
export function playWordSelect() {
    playTone(440, 0.08, "triangle", 0.15, 0);
    playTone(660, 0.12, "triangle", 0.2, 0.06);
}

/** Game Over fanfare */
export function playGameOver() {
    playTone(523, 0.2, "sine", 0.25, 0);       // C5
    playTone(659, 0.2, "sine", 0.25, 0.15);    // E5
    playTone(784, 0.2, "sine", 0.25, 0.3);     // G5
    playTone(1047, 0.4, "sine", 0.3, 0.45);    // C6
    playTone(784, 0.15, "triangle", 0.15, 0.55); // G5 harmony
    playTone(1047, 0.5, "triangle", 0.2, 0.6);   // C6 sustain
}

/** Button click / UI interaction */
export function playClick() {
    playTone(1000, 0.04, "sine", 0.06, 0);
}

/** Error / wrong action */
export function playError() {
    playTone(300, 0.15, "sawtooth", 0.1, 0);
    playTone(250, 0.2, "sawtooth", 0.1, 0.1);
}

/** Ludo dice roll */
export function playLudoDiceRoll() {
    playTone(180, 0.05, "square", 0.08, 0);
    playTone(260, 0.05, "square", 0.08, 0.06);
    playTone(340, 0.08, "triangle", 0.1, 0.12);
}

/** Ludo token movement tick */
export function playLudoTokenMove() {
    playTone(520, 0.04, "triangle", 0.05, 0);
}

/** Ludo capture effect */
export function playLudoCapture() {
    playTone(300, 0.07, "sawtooth", 0.08, 0);
    playTone(220, 0.12, "sawtooth", 0.1, 0.08);
}

/** Ludo victory flourish */
export function playLudoWin() {
    playTone(523, 0.12, "sine", 0.2, 0);
    playTone(659, 0.12, "sine", 0.22, 0.1);
    playTone(784, 0.12, "sine", 0.24, 0.2);
    playTone(1047, 0.35, "triangle", 0.28, 0.3);
}

/** Firecracker-style celebration burst for match winners */
export function playWinCrackers() {
    const bursts = [
        { frequency: 820, delay: 0, volume: 0.08 },
        { frequency: 1140, delay: 0.04, volume: 0.07 },
        { frequency: 930, delay: 0.1, volume: 0.08 },
        { frequency: 1280, delay: 0.15, volume: 0.06 },
        { frequency: 760, delay: 0.22, volume: 0.07 },
        { frequency: 1420, delay: 0.28, volume: 0.06 },
        { frequency: 980, delay: 0.34, volume: 0.07 },
    ];

    bursts.forEach(({ frequency, delay, volume }) => {
        playTone(frequency, 0.035, "square", volume, delay);
        playTone(frequency * 0.55, 0.08, "triangle", volume * 0.5, delay);
    });

    playTone(523, 0.12, "triangle", 0.12, 0.42);
    playTone(784, 0.18, "triangle", 0.14, 0.52);
    playTone(1047, 0.28, "triangle", 0.16, 0.66);
}
