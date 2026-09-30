import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";
import {
  LUDO_COLORS,
  LUDO_SAFE_INDICES,
  canMoveWithDice,
  getMovePath,
  getTrackProgressesFromPath,
  ludoGlobalIndex,
} from "./src/game-logic/ludo";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (port: number) => {
      const tester = net.createServer();

      tester.once("error", (error: NodeJS.ErrnoException) => {
        tester.close();
        if (error.code === "EADDRINUSE") {
          tryPort(port + 1);
          return;
        }
        reject(error);
      });

      tester.once("listening", () => {
        tester.close(() => resolve(port));
      });

      tester.listen(port, "0.0.0.0");
    };

    tryPort(startPort);
  });
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const preferredPort = Number(process.env.PORT || 3000);
  const preferredHmrPort = Number(process.env.HMR_PORT || 24678);
  const port = await findAvailablePort(preferredPort);
  const hmrPort = await findAvailablePort(
    preferredHmrPort === port ? preferredHmrPort + 1 : preferredHmrPort
  );

  // Dynamically get the network IP
  const networkInterfaces = os.networkInterfaces();
  let networkIP = "localhost";
  for (const devName in networkInterfaces) {
    const iface = networkInterfaces[devName];
    if (iface) {
      for (let i = 0; i < iface.length; i++) {
        const alias = iface[i];
        if ((alias.family === "IPv4" || (alias.family as any) === 4 || String(alias.family) === "4") && alias.address !== "127.0.0.1" && !alias.internal) {
          networkIP = alias.address;
          break;
        }
      }
    }
    if (networkIP !== "localhost") break;
  }

  type GameId = "drawing-game" | "ludo" | "snake-ladder" | "xox" | "group-chat";

  // Game State (Drawing)
  const rooms = new Map<string, any>(); // drawing-game rooms (kept for backward compatibility)

  // Game State (Ludo + Snake & Ladder + XOX + Group Chat)
  const ludoRooms = new Map<string, any>();
  const snakeRooms = new Map<string, any>();
  const xoxRooms = new Map<string, any>();
  const groupRooms = new Map<string, any>();

  function getSanitizedGroupRoom(roomCode: string) {
    const room = groupRooms.get(roomCode);
    if (!room) return null;
    return { ...room };
  }

  function getSanitizedXoxRoom(roomCode: string) {
    const room = xoxRooms.get(roomCode);
    if (!room) return null;
    const { ...safeRoom } = room;
    return safeRoom;
  }

  function checkXoxWin(board: (string | null)[], gridSize: number, winLength: number, symbol: string): boolean {
    const dirs = [[0,1],[1,0],[1,1],[1,-1]];
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        for (const [dr, dc] of dirs) {
          let count = 0;
          for (let i = 0; i < winLength; i++) {
            const nr = r + dr * i, nc = c + dc * i;
            if (nr < 0 || nr >= gridSize || nc < 0 || nc >= gridSize) break;
            if (board[nr * gridSize + nc] === symbol) count++; else break;
          }
          if (count === winLength) return true;
        }
      }
    }
    return false;
  }

  function advanceXoxTurn(room: any) {
    if (!Array.isArray(room.turnOrder) || room.turnOrder.length === 0) return;
    const currentIdx = room.turnOrder.indexOf(room.turn?.playerId);
    const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % room.turnOrder.length : 0;
    room.turnIndex = nextIdx;
    room.turn = { playerId: room.turnOrder[nextIdx] };
  }

  function getSocketRoomId(game: GameId, roomCode: string) {
    if (game === "drawing-game") return roomCode; // existing clients rely on this
    return `${game}:${roomCode}`;
  }

  function assignLudoPlayerColors(players: any[]) {
    const colorOrder = players.length === 2
      ? [LUDO_COLORS[0], LUDO_COLORS[2]]
      : LUDO_COLORS.slice(0, players.length);

    players.forEach((player: any, idx: number) => {
      const color = colorOrder[idx];
      player.colorKey = color.key;
      player.color = color.hex;
    });
  }

  function clampRoomCode(raw: string) {
    return (raw || "").toString().trim().toUpperCase().slice(0, 8);
  }

  function getSanitizedLudoRoom(roomCode: string) {
    const room = ludoRooms.get(roomCode);
    if (!room) return null;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { turnTimeout, ...safeRoom } = room;
    return safeRoom;
  }

  function getSanitizedSnakeRoom(roomCode: string) {
    const room = snakeRooms.get(roomCode);
    if (!room) return null;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { turnTimeout, ...safeRoom } = room;
    return safeRoom;
  }

  function getLudoBlockades(room: any) {
    const blockades = new Set<number>();

    for (const player of room.players) {
      const colorKey = player.colorKey as (typeof LUDO_COLORS)[number]["key"] | undefined;
      const tokens: number[] = room.tokens?.[player.id];
      if (!colorKey || !Array.isArray(tokens)) continue;

      const counts = new Map<number, number>();
      for (const progress of tokens) {
        if (progress < 0 || progress > 51) continue;
        const global = ludoGlobalIndex(colorKey, progress);
        counts.set(global, (counts.get(global) ?? 0) + 1);
      }

      for (const [global, count] of counts.entries()) {
        if (count >= 2) blockades.add(global);
      }
    }

    return blockades;
  }

  function validateLudoMove(room: any, playerId: string, tokenIndex: number, dice: number) {
    const tokens: number[] = room.tokens?.[playerId];
    const player = room.players.find((p: any) => p.id === playerId);
    const colorKey = player?.colorKey as (typeof LUDO_COLORS)[number]["key"] | undefined;
    if (!Array.isArray(tokens) || !colorKey) return { ok: false as const, reason: "missing-token-state" };

    const from = Number(tokens[tokenIndex] ?? -1);
    if (!canMoveWithDice(from, dice)) return { ok: false as const, reason: "dice-not-valid" };

    const path = getMovePath(from, dice);
    const to = path[path.length - 1] ?? from;
    const blockades = getLudoBlockades(room);

    for (const progress of getTrackProgressesFromPath(path).slice(0, -1)) {
      const global = ludoGlobalIndex(colorKey, progress);
      if (blockades.has(global)) {
        return { ok: false as const, reason: "path-blocked" };
      }
    }

    return { ok: true as const, from, to, path, colorKey };
  }

  function advanceLudoTurn(room: any) {
    if (!Array.isArray(room.turnOrder) || room.turnOrder.length === 0) return;
    if (typeof room.turnIndex !== "number") room.turnIndex = 0;

    // Ensure current player still exists in order
    room.turnOrder = room.turnOrder.filter((id: string) => room.players.some((p: any) => p.id === id));
    if (room.turnOrder.length === 0) return;

    const currentIdx = room.turnOrder.indexOf(room.turn?.playerId);
    const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % room.turnOrder.length : (room.turnIndex + 1) % room.turnOrder.length;
    room.turnIndex = nextIdx;
    room.turn = { playerId: room.turnOrder[nextIdx], phase: "roll", dice: null };
  }

  const SNAKES: Record<number, number> = {
    17: 7,
    54: 34,
    62: 19,
    64: 60,
    87: 24,
    93: 73,
    95: 75,
    99: 78,
  };

  const LADDERS: Record<number, number> = {
    4: 14,
    9: 31,
    20: 38,
    28: 84,
    40: 59,
    51: 67,
    63: 81,
    71: 91,
  };

  function advanceSnakeTurn(room: any) {
    if (!Array.isArray(room.turnOrder) || room.turnOrder.length === 0) return;
    if (typeof room.turnIndex !== "number") room.turnIndex = 0;

    room.turnOrder = room.turnOrder.filter((id: string) => room.players.some((p: any) => p.id === id));
    if (room.turnOrder.length === 0) return;

    const currentIdx = room.turnOrder.indexOf(room.turn?.playerId);
    const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % room.turnOrder.length : (room.turnIndex + 1) % room.turnOrder.length;
    room.turnIndex = nextIdx;
    room.turn = { playerId: room.turnOrder[nextIdx], phase: "roll", dice: null };
  }

  function resetDrawingGame(roomCode: string) {
    const room = rooms.get(roomCode);
    if (!room || room.players.length < 2) return;

    if (room.interval) {
      clearInterval(room.interval);
      room.interval = null;
    }

    room.players.forEach((p: any) => {
      p.score = 0;
      p.hasGuessed = false;
    });
    room.gameState = "waiting";
    room.currentDrawer = null;
    room.currentDrawerId = null;
    room.currentDrawerKey = null;
    room.currentDrawerIndex = 0;
    room.currentWord = "";
    room.timer = 60;
    room.round = 1;
    room.drawerIndex = 0;
    room.turnInRound = 0;
    room.drawersThisRound = new Set<string>();
    room.usedWords = new Set<string>();
    room.revealedIndices = new Set();
    room.hint = "";
    room.wordChoices = [];

    io.to(roomCode).emit("room-update", getSanitizedRoom(roomCode));
    io.to(roomCode).emit("canvas-cleared");
    startNextTurn(roomCode);
  }

  function resetLudoGame(roomCode: string) {
    const room = ludoRooms.get(roomCode);
    if (!room || room.players.length < 2) return;

    assignLudoPlayerColors(room.players);
    room.tokens = {};
    room.scores = {};
    room.players.forEach((p: any) => {
      room.tokens[p.id] = [-1, -1, -1, -1];
      room.scores[p.id] = 0;
    });
    room.turnOrder = room.players.map((p: any) => p.id);
    room.turnIndex = 0;
    room.turn = { playerId: room.turnOrder[0], phase: "roll", dice: null };
    room.gameState = "playing";
    room.winnerId = null;
    room.lastRoll = null;
    room.lastMove = null;
    room.lastEventId = (room.lastEventId || 0) + 1;
  }

  function resetSnakeGame(roomCode: string) {
    const room = snakeRooms.get(roomCode);
    if (!room || room.players.length < 2) return;

    room.players.forEach((p: any, idx: number) => {
      const color = LUDO_COLORS[idx];
      p.colorKey = color.key;
      p.color = color.hex;
    });

    room.positions = {};
    room.players.forEach((p: any) => {
      room.positions[p.id] = [0, 0, 0];
    });
    room.turnOrder = room.players.map((p: any) => p.id);
    room.turnIndex = 0;
    room.turn = { playerId: room.turnOrder[0], phase: "roll", dice: null };
    room.gameState = "playing";
    room.winnerId = null;
    room.lastRoll = null;
    room.lastMove = null;
    room.lastEventId = (room.lastEventId || 0) + 1;
  }

  const WORDS = [
    // Animals
    "Elephant", "Dolphin", "Penguin", "Octopus", "Crocodile", "Butterfly", "Jellyfish", "Giraffe",
    "Kangaroo", "Flamingo", "Chameleon", "Porcupine", "Hedgehog", "Starfish", "Peacock", "Parrot",
    "Gorilla", "Cheetah", "Hamster", "Turtle", "Lobster", "Seahorse", "Eagle", "Shark",
    "Owl", "Bat", "Snail", "Frog", "Koala", "Panda", "Zebra", "Lion",
    "Tiger", "Bear", "Whale", "Monkey", "Spider", "Scorpion", "Camel", "Rhino",
    "Hippo", "Deer", "Fox", "Wolf", "Rabbit", "Duck", "Rooster", "Swan",
    "Crow", "Ant", "Bee", "Caterpillar", "Dragonfly", "Goldfish", "Crab", "Pigeon",
    // Food & Drinks
    "Pizza", "Sushi", "Hamburger", "Sandwich", "Ice Cream", "Watermelon", "Pancake", "Taco",
    "Burrito", "Donut", "Cupcake", "Popcorn", "Pretzel", "Waffle", "Pineapple", "Banana",
    "Strawberry", "Avocado", "Broccoli", "Carrot", "Mushroom", "Cheese", "Bacon", "Fried Egg",
    "Hot Dog", "French Fries", "Cookie", "Chocolate", "Lollipop", "Candy", "Apple Pie", "Birthday Cake",
    "Milkshake", "Coffee", "Smoothie", "Spaghetti", "Noodles", "Dumpling", "Grape", "Cherry",
    "Mango", "Coconut", "Onion", "Tomato", "Corn", "Potato", "Garlic", "Pepper",
    // Objects & Things
    "Computer", "Keyboard", "Telephone", "Microscope", "Telescope", "Guitar", "Umbrella", "Diamond",
    "Skateboard", "Bicycle", "Sunglasses", "Headphones", "Camera", "Compass", "Hourglass", "Lantern",
    "Magnifying Glass", "Paintbrush", "Scissors", "Hammer", "Wrench", "Screwdriver", "Light Bulb", "Candle",
    "Flashlight", "Backpack", "Suitcase", "Wallet", "Key", "Lock", "Mirror", "Clock",
    "Alarm Clock", "Television", "Microphone", "Speaker", "Battery", "Magnet", "Dice", "Puzzle",
    "Balloon", "Kite", "Yo-yo", "Teddy Bear", "Crown", "Ring", "Necklace", "Treasure Chest",
    "Pillow", "Blanket", "Towel", "Soap", "Toothbrush", "Comb", "Razor", "Broom",
    // Nature & Weather
    "Sunflower", "Mountain", "Rainbow", "Volcano", "Cactus", "Moonlight", "Waterfall", "Palm Tree",
    "Ocean Wave", "Tornado", "Lightning", "Snowflake", "Cloud", "Sunrise", "Sunset", "Aurora",
    "River", "Island", "Desert", "Forest", "Glacier", "Cave", "Canyon", "Coral Reef",
    "Mushroom Cloud", "Earthquake", "Tsunami", "Blizzard", "Meteor", "Comet", "Eclipse", "Star",
    "Moon", "Sun", "Rose", "Tulip", "Daisy", "Bamboo", "Leaf", "Tree",
    // Vehicles & Transport
    "Helicopter", "Firetruck", "Spaceship", "Submarine", "Sailboat", "Hot Air Balloon", "Train",
    "Motorcycle", "Ambulance", "School Bus", "Taxi", "Monster Truck", "Jet Ski", "Canoe",
    "Rocket", "UFO", "Airplane", "Cruise Ship", "Tractor", "Police Car", "Ice Cream Truck",
    "Skateboard", "Roller Skates", "Segway", "Go Kart", "Tank", "Bulldozer", "Crane",
    // Sports & Activities
    "Basketball", "Football", "Tennis", "Volleyball", "Baseball", "Bowling", "Golf", "Boxing",
    "Swimming", "Surfing", "Skiing", "Snowboarding", "Archery", "Fencing", "Gymnastics", "Karate",
    "Wrestling", "Fishing", "Camping", "Hiking", "Yoga", "Skateboarding", "Rock Climbing", "Parkour",
    "Table Tennis", "Badminton", "Cricket", "Rugby", "Darts", "Billiards", "Chess", "Poker",
    // Places & Buildings
    "Castle", "Pyramid", "Lighthouse", "Eiffel Tower", "Statue of Liberty", "Igloo", "Treehouse",
    "Hospital", "School", "Library", "Museum", "Church", "Temple", "Mosque", "Stadium",
    "Airport", "Bridge", "Windmill", "Barn", "Skyscraper", "Palace", "Prison", "Haunted House",
    "Amusement Park", "Zoo", "Aquarium", "Observatory", "Colosseum", "Great Wall",
    // People & Professions
    "Astronaut", "Robot", "Pirate", "Ninja", "Wizard", "Knight", "Mermaid", "Vampire",
    "Zombie", "Ghost", "Alien", "Clown", "Chef", "Doctor", "Firefighter", "Police Officer",
    "Teacher", "Scientist", "Artist", "Musician", "Dancer", "Pilot", "Farmer", "Detective",
    "Superhero", "King", "Queen", "Princess", "Samurai", "Viking", "Cowboy", "Magician",
    // Fantasy & Mythology
    "Dragon", "Unicorn", "Phoenix", "Griffin", "Centaur", "Pegasus", "Cyclops", "Minotaur",
    "Kraken", "Werewolf", "Fairy", "Elf", "Dwarf", "Troll", "Ogre", "Goblin",
    "Witch", "Demon", "Angel", "Genie", "Yeti", "Bigfoot", "Leprechaun", "Medusa",
    // Miscellaneous
    "Snowman", "Scarecrow", "Boomerang", "Trampoline", "Seesaw", "Swing", "Slide", "Ferris Wheel",
    "Roller Coaster", "Merry Go Round", "Pinata", "Fireworks", "Bonfire", "Campfire", "Tent",
    "Hammock", "Fountain", "Statue", "Trophy", "Medal", "Flag", "Map", "Globe",
    "Anchor", "Compass", "Binoculars", "Parachute", "Hang Glider", "Jetpack", "Time Machine",
    "Magic Wand", "Crystal Ball", "Potion", "Treasure Map", "Pirate Ship", "Sword", "Shield",
    "Bow and Arrow", "Catapult", "Cannon", "Dynamite", "Bomb", "Trap", "Net", "Cage"
  ];

  function getSanitizedRoom(roomCode: string) {
    const room = rooms.get(roomCode);
    if (!room) return null;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { interval, drawersThisRound, revealedIndices, usedWords, ...safeRoom } = room;
    return {
      ...safeRoom,
      // Convert Sets to arrays for JSON serialization
      drawersThisRound: drawersThisRound instanceof Set ? [...drawersThisRound] : [],
      revealedIndices: revealedIndices instanceof Set ? [...revealedIndices] : [],
      turnInRound: room.turnInRound ?? 0,
      totalTurnsInRound: getTotalTurnsInRound(room),
    };
  }

  function clampDrawerIndex(room: any) {
    if (typeof room.drawerIndex !== "number" || room.drawerIndex < 0) {
      room.drawerIndex = 0;
    }
    if (Array.isArray(room.turnOrder) && room.turnOrder.length > 0) {
      room.drawerIndex = room.drawerIndex % room.turnOrder.length;
    }
  }

  function getPlayerTurnKey(rawKey: unknown, username: string) {
    const fallback = username.trim().toLowerCase();
    return ((rawKey || fallback) as string).toString().trim().toLowerCase().slice(0, 64);
  }

  function sortPlayersByTurnOrder(room: any) {
    if (!Array.isArray(room.turnOrder)) return;
    const order = new Map<string, number>(room.turnOrder.map((key: string, index: number) => [key, index]));
    room.players.sort((a: any, b: any) => {
      const aIndex = order.get(a.turnKey) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = order.get(b.turnKey) ?? Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex;
    });
  }

  function getNextConnectedDrawer(room: any) {
    if (!Array.isArray(room.turnOrder) || room.turnOrder.length === 0) return null;

    clampDrawerIndex(room);
    for (let offset = 0; offset < room.turnOrder.length; offset++) {
      const candidateIndex = (room.drawerIndex + offset) % room.turnOrder.length;
      const candidateKey = room.turnOrder[candidateIndex];
      const candidate = room.players.find((player: any) => player.turnKey === candidateKey);
      if (candidate) {
        return { candidate, candidateIndex, candidateKey };
      }
    }

    return null;
  }

  /**
   * Get the next drawer for this round by walking turnOrder (join order)
   * and finding the first connected player who hasn't drawn yet this round.
   */
  function getNextDrawerForRound(room: any): { candidate: any; candidateKey: string } | null {
    if (!Array.isArray(room.turnOrder) || room.turnOrder.length === 0) return null;

    const drawersThisRound: Set<string> = room.drawersThisRound || new Set();
    const connectedKeys = new Set(room.players.map((p: any) => p.turnKey));

    for (const turnKey of room.turnOrder) {
      // Skip players who already drew this round
      if (drawersThisRound.has(turnKey)) continue;
      // Skip disconnected players
      if (!connectedKeys.has(turnKey)) continue;

      const candidate = room.players.find((p: any) => p.turnKey === turnKey);
      if (candidate) {
        return { candidate, candidateKey: turnKey };
      }
    }

    return null;
  }

  /**
   * Count how many connected players still need to draw this round.
   */
  function getTurnsRemainingInRound(room: any): number {
    if (!Array.isArray(room.turnOrder)) return 0;
    const drawersThisRound: Set<string> = room.drawersThisRound || new Set();
    const connectedKeys = new Set(room.players.map((p: any) => p.turnKey));
    let remaining = 0;
    for (const turnKey of room.turnOrder) {
      if (!drawersThisRound.has(turnKey) && connectedKeys.has(turnKey)) {
        remaining++;
      }
    }
    return remaining;
  }

  /**
   * Count total connected players (= total turns in a full round cycle).
   */
  function getTotalTurnsInRound(room: any): number {
    if (!Array.isArray(room.turnOrder)) return 0;
    const connectedKeys = new Set(room.players.map((p: any) => p.turnKey));
    let total = 0;
    for (const turnKey of room.turnOrder) {
      if (connectedKeys.has(turnKey)) total++;
    }
    return total;
  }

  function advanceDrawingTurnAfterDisconnect(roomCode: string) {
    const room = rooms.get(roomCode);
    if (!room) return;

    if (room.interval) {
      clearInterval(room.interval);
      room.interval = null;
    }

    if (room.players.length < 2) {
      room.gameState = "waiting";
      room.currentDrawer = null;
      room.currentDrawerId = null;
      room.currentDrawerKey = null;
      room.currentDrawerIndex = 0;
      room.currentWord = "";
      room.wordChoices = [];
      room.timer = 0;
      room.hint = "";
      io.to(roomCode).emit("room-update", getSanitizedRoom(roomCode));
      return;
    }

    room.currentDrawer = null;
    room.currentDrawerId = null;
    room.currentDrawerKey = null;
    room.currentDrawerIndex = 0;
    room.currentWord = "";
    room.wordChoices = [];
    room.timer = 0;
    room.hint = "";
    room.gameState = "waiting";
    io.to(roomCode).emit("canvas-cleared");
    io.to(roomCode).emit("room-update", getSanitizedRoom(roomCode));
    startNextTurn(roomCode);
  }

  /**
   * Start the next turn within the current round (or advance to next round).
   * This is the main entry point for progressing the drawing game.
   */
  function startNextTurn(roomCode: string) {
    const room = rooms.get(roomCode);
    if (!room || room.players.length < 2) return;

    // Initialize drawersThisRound if needed
    if (!(room.drawersThisRound instanceof Set)) {
      room.drawersThisRound = new Set<string>();
    }

    // Find next drawer who hasn't drawn this round
    const next = getNextDrawerForRound(room);

    if (!next) {
      // Everyone connected has drawn — this round is complete
      const maxRounds = room.maxRounds || 3;
      if (room.round < maxRounds) {
        room.round++;
        room.turnInRound = 0;
        room.drawersThisRound = new Set<string>();
        // Recurse to start first turn of the new round
        startNextTurn(roomCode);
      } else {
        // Game over
        room.gameState = "ended";
        room.currentDrawer = null;
        room.currentDrawerId = null;
        room.currentDrawerKey = null;
        room.currentWord = "";
        room.timer = 0;
        room.wordChoices = [];
        room.hint = "";
        io.to(roomCode).emit("game-over", room.players);
        io.to(roomCode).emit("room-update", getSanitizedRoom(roomCode));
      }
      return;
    }

    const { candidate: nextDrawer, candidateKey } = next;

    // Mark this player as having drawn this round
    room.drawersThisRound.add(candidateKey);
    room.turnInRound = (room.turnInRound ?? 0) + 1;

    // Set drawer info
    room.currentDrawer = nextDrawer.id;
    room.currentDrawerId = nextDrawer.id;
    room.currentDrawerKey = candidateKey;
    room.currentDrawerIndex = room.turnOrder.indexOf(candidateKey);

    // Set up the choosing phase
    room.gameState = "choosing";
    room.timer = 15;
    room.currentWord = "";
    room.hint = "";

    // Reset guess status for all players
    room.players.forEach((p: any) => p.hasGuessed = false);

    // Pick 3 random words that haven't been used in this game session
    if (!(room.usedWords instanceof Set)) room.usedWords = new Set<string>();
    let available = WORDS.filter((w) => !room.usedWords.has(w));
    if (available.length < 3) {
      // All words used — reset the pool
      room.usedWords = new Set<string>();
      available = [...WORDS];
    }
    const shuffled = available.sort(() => 0.5 - Math.random());
    const choices = shuffled.slice(0, 3);
    choices.forEach((w: string) => room.usedWords.add(w));
    room.wordChoices = choices;

    io.to(roomCode).emit("room-update", getSanitizedRoom(roomCode));
    io.to(roomCode).emit("canvas-cleared");
    io.to(room.currentDrawer).emit("word-choices", choices);

    // Timer for choosing
    if (room.interval) clearInterval(room.interval);
    room.interval = setInterval(() => {
      room.timer--;
      io.to(roomCode).emit("timer-update", room.timer);

      if (room.timer <= 0) {
        clearInterval(room.interval);
        // Auto-pick first word if drawer didn't choose
        selectWord(roomCode, choices[0]);
      }
    }, 1000);
  }

  function selectWord(roomCode: string, word: string) {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== "choosing") return;

    room.gameState = "playing";
    room.currentWord = word;
    room.timer = 60;
    room.revealedIndices = new Set();
    room.hint = room.currentWord.split('').map(() => '_').join(' ');

    const totalTurns = getTotalTurnsInRound(room);
    const drawerUsername = room.players.find((p: any) => p.id === room.currentDrawer)?.username;

    io.to(roomCode).emit("room-update", getSanitizedRoom(roomCode));
    io.to(roomCode).emit("game-started", {
      currentDrawer: room.currentDrawer,
      currentDrawerId: room.currentDrawerId,
      currentDrawerIndex: room.currentDrawerIndex,
      round: room.round,
      turn: room.turnInRound,
      totalTurnsInRound: totalTurns,
      drawerUsername,
    });
    io.to(room.currentDrawer).emit("secret-word", room.currentWord);
    io.to(roomCode).emit("hint-update", room.hint);

    // Start drawing timer
    if (room.interval) clearInterval(room.interval);
    room.interval = setInterval(() => {
      room.timer--;
      io.to(roomCode).emit("timer-update", room.timer);

      // Hint logic
      let hintChanged = false;
      if (room.timer === 40 && room.revealedIndices.size === 0) {
        room.revealedIndices.add(0);
        hintChanged = true;
      } else if (room.timer === 20 && room.revealedIndices.size === 1 && room.currentWord.length > 3) {
        const available = [];
        for (let i = 1; i < room.currentWord.length; i++) {
          if (!room.revealedIndices.has(i)) available.push(i);
        }
        if (available.length > 0) {
          const randIdx = available[Math.floor(Math.random() * available.length)];
          room.revealedIndices.add(randIdx);
          hintChanged = true;
        }
      }

      if (hintChanged) {
        room.hint = room.currentWord.split('').map((char: string, i: number) =>
          room.revealedIndices.has(i) ? char : '_'
        ).join(' ');
        io.to(roomCode).emit("hint-update", room.hint);
      }

      if (room.timer <= 0) {
        clearInterval(room.interval);
        endTurn(roomCode);
      }
    }, 1000);
  }

  function endTurn(roomCode: string) {
    const room = rooms.get(roomCode);
    if (!room) return;

    room.gameState = "waiting";
    io.to(roomCode).emit("round-ended", { word: room.currentWord });
    io.to(roomCode).emit("room-update", getSanitizedRoom(roomCode));

    // Start the next turn (which handles round advancement internally)
    setTimeout(() => startNextTurn(roomCode), 5000);
  }

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", (payload: any) => {
      const roomCode = clampRoomCode(payload?.roomCode);
      const username = (payload?.username || "").toString().trim().slice(0, 24);
      const game: GameId = (payload?.game as GameId) || "drawing-game";
      const maxRounds = payload?.maxRounds;

      if (!roomCode || !username) {
        socket.emit("join-error", { message: "Missing room code or username." });
        return;
      }

      if (game === "drawing-game") {
        socket.join(roomCode);

        if (!rooms.has(roomCode)) {
          rooms.set(roomCode, {
            code: roomCode,
            game: "drawing-game",
            players: [],
            turnOrder: [],
            gameState: "waiting",
            currentDrawer: null,
            currentDrawerId: null,
            currentDrawerKey: null,
            currentDrawerIndex: 0,
            currentWord: "",
            timer: 60,
            round: 1,
            maxRounds: maxRounds || 3,
            drawerIndex: 0,
            turnInRound: 0,
            drawersThisRound: new Set<string>(),
            networkIP,
            port,
          });
        }

        const room = rooms.get(roomCode);
        if (room.players.length >= 10) {
          socket.emit("join-error", { message: "Drawing room is full (10 players max)." });
          socket.leave(roomCode);
          return;
        }

        // Prevent duplicate players with same socket ID
        if (room.players.find((p: any) => p.id === socket.id)) {
          return;
        }

        const turnKey = getPlayerTurnKey(payload?.playerKey, username);
        if (room.players.find((p: any) => p.turnKey === turnKey)) {
          socket.emit("join-error", { message: "This player is already connected." });
          socket.leave(roomCode);
          return;
        }

        if (!Array.isArray(room.turnOrder)) {
          room.turnOrder = [];
        }
        if (!room.turnOrder.includes(turnKey)) {
          room.turnOrder.push(turnKey);
        }

        const player = {
          id: socket.id,
          turnKey,
          username,
          score: 0,
          isOwner: room.players.length === 0,
          isReady: false,
          hasGuessed: false,
        };

        room.players.push(player);
        sortPlayersByTurnOrder(room);
        if (room.currentDrawerKey === turnKey) {
          room.currentDrawer = socket.id;
          room.currentDrawerId = socket.id;
        }
        io.to(roomCode).emit("room-update", getSanitizedRoom(roomCode));
        return;
      }

      if (game === "ludo") {
        const socketRoomId = getSocketRoomId("ludo", roomCode);
        socket.join(socketRoomId);

        if (!ludoRooms.has(roomCode)) {
          ludoRooms.set(roomCode, {
            code: roomCode,
            game: "ludo",
            players: [],
            gameState: "lobby",
            turn: null,
            tokens: {},
            turnOrder: [],
            turnIndex: 0,
            lastEventId: 0,
            scores: {},
            lastRoll: null,
            lastMove: null,
            networkIP,
            port,
          });
        }

        const room = ludoRooms.get(roomCode);
        if (room.gameState !== "lobby") {
          socket.emit("join-error", { message: "This Ludo game has already started." });
          socket.leave(socketRoomId);
          return;
        }
        if (room.players.length >= 4) {
          socket.emit("join-error", { message: "Ludo room is full (4 players max)." });
          socket.leave(socketRoomId);
          return;
        }

        if (room.players.find((p: any) => p.id === socket.id)) return;

        room.players.push({
          id: socket.id,
          username,
          isOwner: room.players.length === 0,
          colorKey: null,
          color: null,
        });

        io.to(socketRoomId).emit("room-update", getSanitizedLudoRoom(roomCode));
        return;
      }

      if (game === "snake-ladder") {
        const socketRoomId = getSocketRoomId("snake-ladder", roomCode);
        socket.join(socketRoomId);

        if (!snakeRooms.has(roomCode)) {
          snakeRooms.set(roomCode, {
            code: roomCode,
            game: "snake-ladder",
            players: [],
            gameState: "lobby",
            turn: null,
            positions: {},
            turnOrder: [],
            turnIndex: 0,
            lastEventId: 0,
            lastRoll: null,
            lastMove: null,
            snakes: SNAKES,
            ladders: LADDERS,
            networkIP,
            port,
          });
        }

        const room = snakeRooms.get(roomCode);
        if (room.gameState !== "lobby") {
          socket.emit("join-error", { message: "This Snake & Ladder game has already started." });
          socket.leave(socketRoomId);
          return;
        }
        if (room.players.length >= 4) {
          socket.emit("join-error", { message: "Snake & Ladder room is full (4 players max)." });
          socket.leave(socketRoomId);
          return;
        }

        if (room.players.find((p: any) => p.id === socket.id)) return;

        room.players.push({
          id: socket.id,
          username,
          isOwner: room.players.length === 0,
          colorKey: null,
          color: null,
        });

        io.to(socketRoomId).emit("room-update", getSanitizedSnakeRoom(roomCode));
      }

      if (game === "xox") {
        const socketRoomId = getSocketRoomId("xox", roomCode);
        socket.join(socketRoomId);
        if (!xoxRooms.has(roomCode)) {
          xoxRooms.set(roomCode, {
            code: roomCode, game: "xox", players: [], gameState: "lobby",
            turn: null, board: [], gridSize: 3, winLength: 3,
            turnOrder: [], turnIndex: 0, lastEventId: 0, lastMove: null,
            networkIP,
            port,
          });
        }
        const room = xoxRooms.get(roomCode);
        if (room.gameState !== "lobby") {
          socket.emit("join-error", { message: "This XOX game has already started." });
          socket.leave(socketRoomId); return;
        }
        if (room.players.length >= 2) {
          socket.emit("join-error", { message: "XOX room is full (2 players max)." });
          socket.leave(socketRoomId); return;
        }
        if (room.players.find((p: any) => p.id === socket.id)) return;
        room.players.push({ id: socket.id, username, isOwner: room.players.length === 0, symbol: null, color: null, wins: 0 });
        io.to(socketRoomId).emit("room-update", getSanitizedXoxRoom(roomCode));
      }

      if (game === "group-chat") {
        const socketRoomId = getSocketRoomId("group-chat", roomCode);
        socket.join(socketRoomId);
        if (!groupRooms.has(roomCode)) {
          groupRooms.set(roomCode, {
            code: roomCode,
            game: "group-chat",
            players: [],
            messages: [],
            networkIP,
            port,
          });
        }
        const room = groupRooms.get(roomCode);
        const existingPlayer = room.players.find((p: any) => p.id === socket.id);
        if (!existingPlayer) {
          const colors = ["#FF073A", "#00D4FF", "#22C55E", "#EAB308", "#A855F7", "#EC4899"];
          const userColor = colors[room.players.length % colors.length];
          room.players.push({
            id: socket.id,
            username,
            isOwner: room.players.length === 0,
            color: userColor,
          });
        } else {
          existingPlayer.username = username;
        }
        io.to(socketRoomId).emit("room-update", getSanitizedGroupRoom(roomCode));
      }
    });

    socket.on("leave-room", (payload: any) => {
      const roomCode = clampRoomCode(payload?.roomCode);
      const game: GameId = (payload?.game as GameId) || "drawing-game";
      if (!roomCode) return;

      if (game === "drawing-game") {
        socket.leave(roomCode);
        const room = rooms.get(roomCode);
        if (!room) return;

        const index = room.players.findIndex((p: any) => p.id === socket.id);
        if (index === -1) return;
        const leavingPlayer = room.players[index];
        const wasOwner = leavingPlayer.isOwner;
        const wasCurrentDrawer = room.currentDrawer === socket.id;

        if (Array.isArray(room.turnOrder)) {
          const orderIndex = room.turnOrder.indexOf(leavingPlayer.turnKey);
          if (typeof room.drawerIndex === "number" && orderIndex !== -1 && orderIndex < room.drawerIndex) {
            room.drawerIndex = Math.max(0, room.drawerIndex - 1);
          }
        }
        room.players.splice(index, 1);
        // Re-clamp drawer index after player removal
        clampDrawerIndex(room);

        if (room.players.length === 0) {
          rooms.delete(roomCode);
        } else {
          if (wasOwner) room.players[0].isOwner = true;
          if (wasCurrentDrawer && room.gameState !== "ended") {
            advanceDrawingTurnAfterDisconnect(roomCode);
          } else {
            io.to(roomCode).emit("room-update", getSanitizedRoom(roomCode));
          }
        }
        return;
      }

      if (game === "ludo") {
        const socketRoomId = getSocketRoomId("ludo", roomCode);
        socket.leave(socketRoomId);
        const room = ludoRooms.get(roomCode);
        if (!room) return;

        const index = room.players.findIndex((p: any) => p.id === socket.id);
        if (index === -1) return;
        const wasOwner = room.players[index].isOwner;
        room.players.splice(index, 1);
        if (room.tokens) delete room.tokens[socket.id];
        if (Array.isArray(room.turnOrder)) room.turnOrder = room.turnOrder.filter((id: string) => id !== socket.id);

        if (room.players.length === 0) {
          ludoRooms.delete(roomCode);
          return;
        }

        if (wasOwner) room.players[0].isOwner = true;
        if (room.gameState === "playing" && room.players.length === 1) {
          room.gameState = "ended";
          room.winnerId = room.players[0].id;
        }
        if (room.gameState === "playing" && room.turn?.playerId === socket.id) {
          advanceLudoTurn(room);
        }
        io.to(socketRoomId).emit("room-update", getSanitizedLudoRoom(roomCode));
        return;
      }

      if (game === "snake-ladder") {
        const socketRoomId = getSocketRoomId("snake-ladder", roomCode);
        socket.leave(socketRoomId);
        const room = snakeRooms.get(roomCode);
        if (!room) return;

        const index = room.players.findIndex((p: any) => p.id === socket.id);
        if (index === -1) return;
        const wasOwner = room.players[index].isOwner;
        room.players.splice(index, 1);
        if (room.positions) delete room.positions[socket.id];
        // Also remove finished tokens tracking
        if (Array.isArray(room.turnOrder)) room.turnOrder = room.turnOrder.filter((id: string) => id !== socket.id);

        if (room.players.length === 0) {
          snakeRooms.delete(roomCode);
          return;
        }

        if (wasOwner) room.players[0].isOwner = true;
        if (room.gameState === "playing" && room.players.length === 1) {
          room.gameState = "ended";
          room.winnerId = room.players[0].id;
        }
        if (room.gameState === "playing" && room.turn?.playerId === socket.id) {
          advanceSnakeTurn(room);
        }
        io.to(socketRoomId).emit("room-update", getSanitizedSnakeRoom(roomCode));
      }

      if (game === "xox") {
        const socketRoomId = getSocketRoomId("xox", roomCode);
        socket.leave(socketRoomId);
        const room = xoxRooms.get(roomCode);
        if (!room) return;
        const index = room.players.findIndex((p: any) => p.id === socket.id);
        if (index === -1) return;
        const wasOwner = room.players[index].isOwner;
        room.players.splice(index, 1);
        if (room.players.length === 0) { xoxRooms.delete(roomCode); return; }
        if (wasOwner) room.players[0].isOwner = true;
        if (room.gameState === "playing") {
          room.gameState = "ended";
          room.winnerId = room.players[0]?.id;
          if (room.players[0]) {
            room.players[0].wins = (room.players[0].wins || 0) + 1;
          }
        }
        io.to(socketRoomId).emit("room-update", getSanitizedXoxRoom(roomCode));
      }

      if (game === "group-chat") {
        const socketRoomId = getSocketRoomId("group-chat", roomCode);
        socket.leave(socketRoomId);
        const room = groupRooms.get(roomCode);
        if (!room) return;
        const index = room.players.findIndex((p: any) => p.id === socket.id);
        if (index !== -1) {
          const wasOwner = room.players[index].isOwner;
          room.players.splice(index, 1);
          if (room.players.length === 0) {
            groupRooms.delete(roomCode);
            return;
          }
          if (wasOwner && room.players.length > 0) room.players[0].isOwner = true;
          io.to(socketRoomId).emit("room-update", getSanitizedGroupRoom(roomCode));
        }
      }
    });

    socket.on("start-game", (payload: any) => {
      // Backward compatible: drawing game sends `start-game` with a string roomCode.
      if (typeof payload === "string") {
        const roomCode = clampRoomCode(payload);
        const room = rooms.get(roomCode);
        if (room && room.gameState === "waiting" && room.players.length >= 2) {
          const player = room.players.find((p: any) => p.id === socket.id);
          if (player?.isOwner) {
            // Reset round state for a fresh game start
            room.round = 1;
            room.turnInRound = 0;
            room.drawersThisRound = new Set<string>();
            startNextTurn(roomCode);
          }
        }
        return;
      }

      const roomCode = clampRoomCode(payload?.roomCode);
      const game: GameId = payload?.game as GameId;
      if (!roomCode || !game) return;

      if (game === "ludo") {
        const room = ludoRooms.get(roomCode);
        if (!room || room.gameState !== "lobby") return;
        if (room.players.length < 2) return;

        const player = room.players.find((p: any) => p.id === socket.id);
        if (!player?.isOwner) return;
        resetLudoGame(roomCode);

        const socketRoomId = getSocketRoomId("ludo", roomCode);
        io.to(socketRoomId).emit("room-update", getSanitizedLudoRoom(roomCode));
        return;
      }

      if (game === "snake-ladder") {
        const room = snakeRooms.get(roomCode);
        if (!room || room.gameState !== "lobby") return;
        if (room.players.length < 2) return;

        const player = room.players.find((p: any) => p.id === socket.id);
        if (!player?.isOwner) return;
        resetSnakeGame(roomCode);

        const socketRoomId = getSocketRoomId("snake-ladder", roomCode);
        io.to(socketRoomId).emit("room-update", getSanitizedSnakeRoom(roomCode));
      }

      if (game === "xox") {
        const room = xoxRooms.get(roomCode);
        if (!room || room.gameState !== "lobby") return;
        if (room.players.length !== 2) return;
        const player = room.players.find((p: any) => p.id === socket.id);
        if (!player?.isOwner) return;
        const gridSize = Math.min(8, Math.max(3, Number(payload?.gridSize) || 3));
        const winLength = gridSize <= 4 ? gridSize : Math.min(5, gridSize);
        room.gridSize = gridSize;
        room.winLength = winLength;
        room.board = Array(gridSize * gridSize).fill(null);
        room.players[0].symbol = "X"; room.players[0].color = "#FF073A";
        room.players[1].symbol = "O"; room.players[1].color = "#00D4FF";
        room.turnOrder = room.players.map((p: any) => p.id);
        room.turnIndex = 0;
        room.turn = { playerId: room.turnOrder[0] };
        room.gameState = "playing";
        room.winnerId = null; room.isDraw = false;
        room.lastEventId = (room.lastEventId || 0) + 1;
        const socketRoomId = getSocketRoomId("xox", roomCode);
        io.to(socketRoomId).emit("room-update", getSanitizedXoxRoom(roomCode));
      }
    });

    socket.on("ludo-roll-dice", (payload: any) => {
      const roomCode = clampRoomCode(payload?.roomCode);
      const room = ludoRooms.get(roomCode);
      if (!room || room.gameState !== "playing") return;
      if (!room.turn || room.turn.playerId !== socket.id || room.turn.phase !== "roll") return;

      const dice = 1 + Math.floor(Math.random() * 6);
      room.turn.dice = dice;
      room.turn.phase = "move";
      room.lastEventId = (room.lastEventId || 0) + 1;
      room.lastRoll = { by: socket.id, dice, id: room.lastEventId };

      const tokens: number[] = room.tokens?.[socket.id] ?? [-1, -1, -1, -1];
      const movable = tokens
        .map((_, idx) => ({ idx, can: validateLudoMove(room, socket.id, idx, dice).ok }))
        .filter((x) => x.can);

      if (movable.length === 0) {
        room.lastMove = { type: "pass", by: socket.id, dice, id: room.lastEventId };
        advanceLudoTurn(room);
      }

      const socketRoomId = getSocketRoomId("ludo", roomCode);
      io.to(socketRoomId).emit("room-update", getSanitizedLudoRoom(roomCode));
    });

    socket.on("ludo-move-token", (payload: any) => {
      const roomCode = clampRoomCode(payload?.roomCode);
      const tokenIndex = Number(payload?.tokenIndex);
      const room = ludoRooms.get(roomCode);
      if (!room || room.gameState !== "playing") return;
      if (!room.turn || room.turn.playerId !== socket.id || room.turn.phase !== "move") return;
      if (!Number.isInteger(tokenIndex) || tokenIndex < 0 || tokenIndex > 3) return;

      const dice: number | null = room.turn.dice;
      if (!dice) return;

      const tokens: number[] = room.tokens?.[socket.id];
      if (!Array.isArray(tokens) || tokens.length !== 4) return;

      const validation = validateLudoMove(room, socket.id, tokenIndex, dice);
      if (!validation.ok) return;

      const { from, to, path, colorKey: moverColorKey } = validation;
      tokens[tokenIndex] = to;

      const captured: Array<{ playerId: string; tokenIndex: number }> = [];

      if (typeof moverColorKey === "string" && to >= 0 && to <= 51) {
        const landedGlobal = ludoGlobalIndex(moverColorKey, to);
        const isSafe = LUDO_SAFE_INDICES.has(landedGlobal);

        if (!isSafe) {
          for (const op of room.players) {
            if (op.id === socket.id) continue;
            const opTokens: number[] = room.tokens?.[op.id];
            if (!Array.isArray(opTokens)) continue;
            const opColorKey = op.colorKey as (typeof LUDO_COLORS)[number]["key"] | undefined;
            if (typeof opColorKey !== "string") continue;

            for (let i = 0; i < opTokens.length; i++) {
              const prog = opTokens[i];
              if (prog >= 0 && prog <= 51) {
                const opGlobal = ludoGlobalIndex(opColorKey, prog);
                if (opGlobal === landedGlobal) {
                  opTokens[i] = -1;
                  captured.push({ playerId: op.id, tokenIndex: i });
                }
              }
            }
          }
        }
      }

      room.lastEventId = (room.lastEventId || 0) + 1;
      room.lastMove = { type: "move", by: socket.id, tokenIndex, from, to, dice, path, captured, id: room.lastEventId };
      if (!room.scores) room.scores = {};
      if (captured.length > 0) {
        room.scores[socket.id] = (room.scores[socket.id] || 0) + captured.length;
      }

      const allHome = tokens.every((p) => p === 57);
      if (allHome) {
        room.gameState = "ended";
        room.winnerId = socket.id;
      } else if (dice === 6) {
        room.turn = { playerId: socket.id, phase: "roll", dice: null };
      } else {
        advanceLudoTurn(room);
      }

      const socketRoomId = getSocketRoomId("ludo", roomCode);
      io.to(socketRoomId).emit("room-update", getSanitizedLudoRoom(roomCode));
    });

    socket.on("snake-roll-dice", (payload: any) => {
      const roomCode = clampRoomCode(payload?.roomCode);
      const room = snakeRooms.get(roomCode);
      if (!room || room.gameState !== "playing") return;
      if (!room.turn || room.turn.playerId !== socket.id || room.turn.phase !== "roll") return;

      const dice = 1 + Math.floor(Math.random() * 6);
      room.turn.dice = dice;
      room.lastEventId = (room.lastEventId || 0) + 1;
      room.lastRoll = { by: socket.id, dice, id: room.lastEventId };

      // Check if any token can move
      const tokens: number[] = room.positions?.[socket.id] ?? [0, 0, 0];
      const movable = tokens.map((pos: number, idx: number) => {
        if (pos >= 100) return false; // already finished
        return pos + dice <= 100;
      });

      if (movable.some((canMove: boolean) => canMove)) {
        room.turn.phase = "move";
      } else {
        // No token can move, skip turn
        room.lastMove = { by: socket.id, tokenIndex: -1, from: 0, dice, to: 0, final: 0, effect: null, id: room.lastEventId };
        advanceSnakeTurn(room);
      }

      const socketRoomId = getSocketRoomId("snake-ladder", roomCode);
      io.to(socketRoomId).emit("room-update", getSanitizedSnakeRoom(roomCode));
    });

    socket.on("snake-move-token", (payload: any) => {
      const roomCode = clampRoomCode(payload?.roomCode);
      const tokenIndex = Number(payload?.tokenIndex);
      const room = snakeRooms.get(roomCode);
      if (!room || room.gameState !== "playing") return;
      if (!room.turn || room.turn.playerId !== socket.id || room.turn.phase !== "move") return;
      if (!Number.isInteger(tokenIndex) || tokenIndex < 0 || tokenIndex > 2) return;

      const dice: number | null = room.turn.dice;
      if (!dice) return;

      const tokens: number[] = room.positions?.[socket.id] ?? [0, 0, 0];
      const from = tokens[tokenIndex];
      if (from >= 100) return; // already finished
      if (from + dice > 100) return; // can't move past 100

      const tentative = from + dice;
      let final = tentative;
      let effect: "snake" | "ladder" | null = null;
      if (room.ladders?.[tentative]) {
        final = room.ladders[tentative];
        effect = "ladder";
      } else if (room.snakes?.[tentative]) {
        final = room.snakes[tentative];
        effect = "snake";
      }

      tokens[tokenIndex] = final;
      room.positions[socket.id] = tokens;
      room.lastEventId = (room.lastEventId || 0) + 1;
      room.lastMove = { by: socket.id, tokenIndex, from, dice, to: tentative, final, effect, id: room.lastEventId };

      // Win condition: all 3 tokens at 100
      const allFinished = tokens.every((pos: number) => pos >= 100);
      if (allFinished) {
        room.gameState = "ended";
        room.winnerId = socket.id;
      } else if (dice === 6) {
        // Rolling a 6 gives another turn
        room.turn = { playerId: socket.id, phase: "roll", dice: null };
      } else {
        advanceSnakeTurn(room);
      }

      const socketRoomId = getSocketRoomId("snake-ladder", roomCode);
      io.to(socketRoomId).emit("room-update", getSanitizedSnakeRoom(roomCode));
    });

    socket.on("xox-place", (payload: any) => {
      const roomCode = clampRoomCode(payload?.roomCode);
      const cell = Number(payload?.cell);
      const room = xoxRooms.get(roomCode);
      if (!room || room.gameState !== "playing") return;
      if (!room.turn || room.turn.playerId !== socket.id) return;
      if (!Number.isInteger(cell) || cell < 0 || cell >= room.board.length) return;
      if (room.board[cell] !== null) return;
      const player = room.players.find((p: any) => p.id === socket.id);
      if (!player?.symbol) return;
      room.board[cell] = player.symbol;
      room.lastEventId = (room.lastEventId || 0) + 1;
      room.lastMove = { by: socket.id, cell, id: room.lastEventId };
      if (checkXoxWin(room.board, room.gridSize, room.winLength, player.symbol)) {
        room.gameState = "ended"; room.winnerId = socket.id;
        player.wins = (player.wins || 0) + 1;
      } else if (room.board.every((c: any) => c !== null)) {
        room.gameState = "ended"; room.isDraw = true;
      } else {
        advanceXoxTurn(room);
      }
      const socketRoomId = getSocketRoomId("xox", roomCode);
      io.to(socketRoomId).emit("room-update", getSanitizedXoxRoom(roomCode));
    });

    socket.on("xox-restart", (payload: any) => {
      const roomCode = clampRoomCode(payload?.roomCode);
      const room = xoxRooms.get(roomCode);
      if (!room || room.gameState !== "ended") return;
      const player = room.players.find((p: any) => p.id === socket.id);
      if (!player?.isOwner) return;
      if (room.players.length !== 2) return;

      // Reset board, swap starting player
      room.board = Array(room.gridSize * room.gridSize).fill(null);
      room.turnOrder = [...room.turnOrder].reverse();
      room.turnIndex = 0;
      room.turn = { playerId: room.turnOrder[0] };
      room.gameState = "playing";
      room.winnerId = null;
      room.isDraw = false;
      room.lastMove = null;
      room.lastEventId = (room.lastEventId || 0) + 1;

      const socketRoomId = getSocketRoomId("xox", roomCode);
      io.to(socketRoomId).emit("room-update", getSanitizedXoxRoom(roomCode));
    });

    socket.on("drawing-restart", (payload: any) => {
      const roomCode = clampRoomCode(payload?.roomCode);
      const room = rooms.get(roomCode);
      if (!room || room.gameState !== "ended") return;
      const player = room.players.find((p: any) => p.id === socket.id);
      if (!player?.isOwner) return;
      resetDrawingGame(roomCode);
    });

    socket.on("ludo-restart", (payload: any) => {
      const roomCode = clampRoomCode(payload?.roomCode);
      const room = ludoRooms.get(roomCode);
      if (!room || room.gameState !== "ended") return;
      const player = room.players.find((p: any) => p.id === socket.id);
      if (!player?.isOwner) return;
      resetLudoGame(roomCode);

      const socketRoomId = getSocketRoomId("ludo", roomCode);
      io.to(socketRoomId).emit("room-update", getSanitizedLudoRoom(roomCode));
    });

    socket.on("snake-restart", (payload: any) => {
      const roomCode = clampRoomCode(payload?.roomCode);
      const room = snakeRooms.get(roomCode);
      if (!room || room.gameState !== "ended") return;
      const player = room.players.find((p: any) => p.id === socket.id);
      if (!player?.isOwner) return;
      resetSnakeGame(roomCode);

      const socketRoomId = getSocketRoomId("snake-ladder", roomCode);
      io.to(socketRoomId).emit("room-update", getSanitizedSnakeRoom(roomCode));
    });

    socket.on("select-word", ({ roomCode, word }) => {
      const room = rooms.get(roomCode);
      if (room && room.currentDrawer === socket.id) {
        selectWord(roomCode, word);
      }
    });

    socket.on("draw", ({ roomCode, drawingData }) => {
      const normalizedRoomCode = clampRoomCode(roomCode);
      const room = rooms.get(normalizedRoomCode);
      if (!room || room.gameState !== "playing") return;
      if (room.currentDrawer !== socket.id) return;

      socket.to(normalizedRoomCode).emit("draw-update", drawingData);
    });

    socket.on("clear-canvas", (roomCode) => {
      const normalizedRoomCode = clampRoomCode(roomCode);
      const room = rooms.get(normalizedRoomCode);
      if (!room) return;
      if (room.currentDrawer !== socket.id) return;

      io.to(normalizedRoomCode).emit("canvas-cleared");
    });

    socket.on("send-message", (payload: any) => {
      const roomCode = clampRoomCode(payload?.roomCode);
      const message = (payload?.message || "").toString();
      const username = (payload?.username || "").toString().trim().slice(0, 24);
      const game: GameId = (payload?.game as GameId) || "drawing-game";

      if (!roomCode || !message || !username) return;

      if (game === "ludo") {
        const socketRoomId = getSocketRoomId("ludo", roomCode);
        if (!ludoRooms.has(roomCode)) return;
        io.to(socketRoomId).emit("new-message", { username, message });
        return;
      }

      if (game === "snake-ladder") {
        const socketRoomId = getSocketRoomId("snake-ladder", roomCode);
        if (!snakeRooms.has(roomCode)) return;
        io.to(socketRoomId).emit("new-message", { username, message });
        return;
      }

      if (game === "xox") {
        const socketRoomId = getSocketRoomId("xox", roomCode);
        if (!xoxRooms.has(roomCode)) return;
        io.to(socketRoomId).emit("new-message", { username, message });
        return;
      }

      if (game === "group-chat") {
        const socketRoomId = getSocketRoomId("group-chat", roomCode);
        const room = groupRooms.get(roomCode);
        if (!room) return;
        const msgObj = {
          username,
          message,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          id: Math.random().toString(36).substring(2, 9),
        };
        if (!Array.isArray(room.messages)) room.messages = [];
        room.messages.push(msgObj);
        if (room.messages.length > 100) room.messages.shift();
        io.to(socketRoomId).emit("new-message", msgObj);
        io.to(socketRoomId).emit("room-update", getSanitizedGroupRoom(roomCode));
        return;
      }

      // Drawing Game (backward compatible)
      const room = rooms.get(roomCode);
      if (!room) return;

      // Check if guess is correct
      if (room.gameState === "playing" && message.toLowerCase().trim() === room.currentWord.toLowerCase()) {
        const player = room.players.find((p: any) => p.id === socket.id);

        // Ensure player hasn't already guessed correctly and isn't the drawer
        if (player && player.id !== room.currentDrawer && !player.hasGuessed) {
          const pointsEarned = Math.floor((room.timer / 60) * 1000);
          player.score += pointsEarned;
          player.hasGuessed = true;

          // Reward the drawer as well
          const drawer = room.players.find((p: any) => p.id === room.currentDrawer);
          if (drawer) {
            drawer.score += 200; // Bonus for drawer when someone guesses
          }

          io.to(roomCode).emit("correct-guess", { username, score: player.score });
          io.to(roomCode).emit("room-update", getSanitizedRoom(roomCode));

          // Check if everyone has guessed
          const guessers = room.players.filter((p: any) => p.id !== room.currentDrawer);
          const allGuessed = guessers.every((p: any) => p.hasGuessed);
          if (allGuessed) {
            clearInterval(room.interval);
            endTurn(roomCode);
          }
        }
      } else {
        io.to(roomCode).emit("new-message", { username, message });
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);

      // Drawing rooms
      rooms.forEach((room, roomCode) => {
        const index = room.players.findIndex((p: any) => p.id === socket.id);
        if (index === -1) return;
        const leavingPlayer = room.players[index];
        const wasOwner = leavingPlayer.isOwner;
        const wasCurrentDrawer = room.currentDrawer === socket.id;

        if (Array.isArray(room.turnOrder)) {
          const orderIndex = room.turnOrder.indexOf(leavingPlayer.turnKey);
          if (typeof room.drawerIndex === "number" && orderIndex !== -1 && orderIndex < room.drawerIndex) {
            room.drawerIndex = Math.max(0, room.drawerIndex - 1);
          }
        }
        room.players.splice(index, 1);
        // Re-clamp drawer index after player removal
        clampDrawerIndex(room);

        if (room.players.length === 0) {
          rooms.delete(roomCode);
        } else {
          if (wasOwner) room.players[0].isOwner = true;
          if (wasCurrentDrawer && room.gameState !== "ended") {
            advanceDrawingTurnAfterDisconnect(roomCode);
          } else {
            io.to(roomCode).emit("room-update", getSanitizedRoom(roomCode));
          }
        }
      });

      // Ludo rooms
      ludoRooms.forEach((room, roomCode) => {
        const index = room.players.findIndex((p: any) => p.id === socket.id);
        if (index === -1) return;

        const wasOwner = room.players[index].isOwner;
        room.players.splice(index, 1);
        if (room.tokens) delete room.tokens[socket.id];
        if (Array.isArray(room.turnOrder)) room.turnOrder = room.turnOrder.filter((id: string) => id !== socket.id);

        if (room.players.length === 0) {
          ludoRooms.delete(roomCode);
          return;
        }

        if (wasOwner) room.players[0].isOwner = true;
        if (room.gameState === "playing" && room.players.length === 1) {
          room.gameState = "ended";
          room.winnerId = room.players[0].id;
        }
        if (room.gameState === "playing" && room.turn?.playerId === socket.id) {
          advanceLudoTurn(room);
        }

        const socketRoomId = getSocketRoomId("ludo", roomCode);
        io.to(socketRoomId).emit("room-update", getSanitizedLudoRoom(roomCode));
      });

      // Snake rooms
      snakeRooms.forEach((room, roomCode) => {
        const index = room.players.findIndex((p: any) => p.id === socket.id);
        if (index === -1) return;

        const wasOwner = room.players[index].isOwner;
        room.players.splice(index, 1);
        if (room.positions) delete room.positions[socket.id];
        if (Array.isArray(room.turnOrder)) room.turnOrder = room.turnOrder.filter((id: string) => id !== socket.id);

        if (room.players.length === 0) {
          snakeRooms.delete(roomCode);
          return;
        }

        if (wasOwner) room.players[0].isOwner = true;
        if (room.gameState === "playing" && room.players.length === 1) {
          room.gameState = "ended";
          room.winnerId = room.players[0].id;
        }
        if (room.gameState === "playing" && room.turn?.playerId === socket.id) {
          advanceSnakeTurn(room);
        }

        const socketRoomId = getSocketRoomId("snake-ladder", roomCode);
        io.to(socketRoomId).emit("room-update", getSanitizedSnakeRoom(roomCode));
      });

      // XOX rooms
      xoxRooms.forEach((room, roomCode) => {
        const index = room.players.findIndex((p: any) => p.id === socket.id);
        if (index === -1) return;
        const wasOwner = room.players[index].isOwner;
        room.players.splice(index, 1);
        if (room.players.length === 0) { xoxRooms.delete(roomCode); return; }
        if (wasOwner) room.players[0].isOwner = true;
        if (room.gameState === "playing") {
          room.gameState = "ended";
          room.winnerId = room.players[0]?.id;
          if (room.players[0]) {
            room.players[0].wins = (room.players[0].wins || 0) + 1;
          }
        }
        const socketRoomId = getSocketRoomId("xox", roomCode);
        io.to(socketRoomId).emit("room-update", getSanitizedXoxRoom(roomCode));
      });

      // Group Chat rooms
      groupRooms.forEach((room, roomCode) => {
        const index = room.players.findIndex((p: any) => p.id === socket.id);
        if (index === -1) return;
        const wasOwner = room.players[index].isOwner;
        room.players.splice(index, 1);
        const socketRoomId = getSocketRoomId("group-chat", roomCode);
        if (room.players.length === 0) {
          groupRooms.delete(roomCode);
        } else {
          if (wasOwner && room.players.length > 0) room.players[0].isOwner = true;
          io.to(socketRoomId).emit("room-update", getSanitizedGroupRoom(roomCode));
        }
      });
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: true,
        hmr: {
          port: hmrPort,
        },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(port, "0.0.0.0", () => {
    const localUrl = `http://localhost:${port}`;
    const networkUrl = `http://${networkIP}:${port}`;

    console.log(`\x1b[32m➜\x1b[0m  \x1b[1mLocal:\x1b[0m   ${localUrl}`);
    console.log(`\x1b[32m➜\x1b[0m  \x1b[1mNetwork:\x1b[0m ${networkUrl}`);
    if (port !== preferredPort) {
      console.log(`\x1b[33mPort ${preferredPort} was busy, using ${port} instead.\x1b[0m`);
    }
    console.log(`\x1b[2mWaiting for players...\x1b[0m`);
  });
}

startServer();
