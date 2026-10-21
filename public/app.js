// SillyTavern-style Visual Novel Client with Venus Daypart Loop

const LOCATIONS = {
  living_room: {
    id: 'living_room',
    name: 'Living Room',
    bgDay: 'assets/places/your-apartment/night.png',
    bgNight: 'assets/places/your-apartment/night.png',
    defaultChar: 'rin'
  },
  rin_room: {
    id: 'rin_room',
    name: "Rin's Bedroom",
    bgDay: 'assets/characters/rin/room_day.png',
    bgNight: 'assets/characters/rin/room_night.png',
    defaultChar: 'rin'
  },
  hana_room: {
    id: 'hana_room',
    name: "Hana's Bedroom",
    bgDay: 'assets/characters/hana/room_day.png',
    bgNight: 'assets/characters/hana/room_night.png',
    defaultChar: 'hana'
  },
  diner: {
    id: 'diner',
    name: 'Diner Counter',
    bgDay: 'assets/places/mizunoki-mai-counter/day.png',
    bgNight: 'assets/places/mizunoki-mai-counter/day.png',
    defaultChar: 'rin'
  },
  station_lane: {
    id: 'station_lane',
    name: 'Station Lane (Shopping)',
    bgDay: 'assets/places/mizunoki-station-lane/day.png',
    bgNight: 'assets/places/mizunoki-station-lane/day.png',
    defaultChar: null
  },
  park: {
    id: 'park',
    name: 'Night Park',
    bgDay: 'assets/places/park-at-night/night.png',
    bgNight: 'assets/places/park-at-night/night.png',
    defaultChar: 'hana'
  },
  love_hotel: {
    id: 'love_hotel',
    name: 'Love Hotel Suite',
    bgDay: 'assets/places/love-hotel/night.png',
    bgNight: 'assets/places/love-hotel/night.png',
    defaultChar: 'rin'
  }
};

const DAYPARTS = ['Morning', 'Afternoon', 'Evening'];

// Game State
let state = {
  day: 1,
  daypartIndex: 0,
  money: 2500,
  location: 'living_room',
  characterId: 'rin',
  affection: {
    rin: 1,
    hana: 1
  },
  history: {
    rin: [],
    hana: []
  }
};

// Cached character definitions from /api/characters
let characters = {};

// DOM Elements
const bgLayer = document.getElementById('bg-layer');
const charSprite = document.getElementById('character-sprite');
const hudTime = document.getElementById('hud-time');
const hudLocation = document.getElementById('hud-location');
const hudMoney = document.getElementById('hud-money');
const hudAffection = document.getElementById('hud-affection');
const speakerName = document.getElementById('speaker-name');
const speakerRole = document.getElementById('speaker-role');
const dialogueText = document.getElementById('dialogue-text');
const quickReplies = document.getElementById('quick-replies');
const userInput = document.getElementById('user-input');
const btnSend = document.getElementById('btn-send');

const mapModal = document.getElementById('map-modal');
const btnMap = document.getElementById('btn-map');
const btnCloseMap = document.getElementById('btn-close-map');
const mapDestinations = document.getElementById('map-destinations');

const actionsModal = document.getElementById('actions-modal');
const btnActionRow = document.getElementById('btn-action-row');
const btnCloseActions = document.getElementById('btn-close-actions');
const btnDoWork = document.getElementById('btn-do-work');
const btnDoGift = document.getElementById('btn-do-gift');
const btnDoRest = document.getElementById('btn-do-rest');

// Load characters from server
async function init() {
  try {
    const res = await fetch('/api/characters');
    const data = await res.json();
    data.forEach(c => { characters[c.id] = c; });
  } catch (err) {
    console.error('Failed to load characters:', err);
  }

  // Load saved state if available
  const saved = localStorage.getItem('vn_sandbox_state');
  if (saved) {
    try { state = JSON.parse(saved); } catch (e) {}
  }

  renderHUD();
  updateScene();
  setupEventListeners();

  // Initial welcome greeting if chat history is empty
  const char = characters[state.characterId];
  if (char && state.history[char.id].length === 0) {
    const opening = char.dialogueExamples?.[0] || '[smile] "Good morning. Are you ready for today?"';
    handleNPCReply(opening);
  }
}

function saveState() {
  localStorage.setItem('vn_sandbox_state', JSON.stringify(state));
}

function renderHUD() {
  const dpName = DAYPARTS[state.daypartIndex];
  hudTime.textContent = `Day ${state.day} • ${dpName}`;
  hudMoney.textContent = `💰 ¥${state.money.toLocaleString()}`;

  const loc = LOCATIONS[state.location] || LOCATIONS.living_room;
  hudLocation.textContent = `📍 ${loc.name}`;

  const aff = state.affection[state.characterId] || 1;
  hudAffection.textContent = `❤️ Level ${aff}/5`;

  // Update daypart tracker dots
  ['morning', 'afternoon', 'evening'].forEach((id, idx) => {
    const dot = document.getElementById(`dp-${id}`);
    if (dot) {
      dot.classList.toggle('active', idx === state.daypartIndex);
    }
  });
}

function updateScene() {
  const loc = LOCATIONS[state.location] || LOCATIONS.living_room;
  const isNight = state.daypartIndex === 2;

  // Background
  const bgUrl = (isNight && loc.bgNight) ? loc.bgNight : loc.bgDay;
  bgLayer.style.backgroundImage = `url('${bgUrl}')`;

  // Character presence
  const char = characters[state.characterId];
  if (char) {
    speakerName.textContent = char.name;
    speakerRole.textContent = char.role;
    updateSprite('neutral');
    charSprite.style.display = 'block';
  } else {
    charSprite.style.display = 'none';
    speakerName.textContent = 'Narrator';
    speakerRole.textContent = '';
  }

  renderHUD();
  saveState();
}

function updateSprite(expression) {
  const char = characters[state.characterId];
  if (!char) return;

  const sprites = char.sprites || {};
  const spriteUrl = sprites[expression] || sprites.neutral || Object.values(sprites)[0];

  if (spriteUrl) {
    charSprite.style.opacity = '0';
    setTimeout(() => {
      charSprite.src = spriteUrl;
      charSprite.style.opacity = '1';
    }, 150);
  }
}

// Typewriter effect for dialogue
function typeText(text, callback) {
  dialogueText.textContent = '';
  let i = 0;
  const speed = 18;

  function type() {
    if (i < text.length) {
      dialogueText.textContent += text.charAt(i);
      i++;
      setTimeout(type, speed);
    } else {
      if (callback) callback();
    }
  }
  type();
}

// Generate contextual quick reply chips
function updateQuickReplies() {
  quickReplies.innerHTML = '';
  const char = characters[state.characterId];
  if (!char) return;

  let suggestions = [
    `Ask how her day is going`,
    `Tease her gently`,
    `Step closer and compliment her`
  ];

  if (state.daypartIndex === 2) {
    suggestions = [
      `Invite her to stay a bit longer`,
      `Offer to pour a drink`,
      `Ask if she wants to go to your room`
    ];
  }

  suggestions.forEach(text => {
    const btn = document.createElement('button');
    btn.className = 'chip-btn';
    btn.textContent = text;
    btn.onclick = () => {
      sendMessage(text);
    };
    quickReplies.appendChild(btn);
  });
}

async function sendMessage(text) {
  if (!text || !text.trim()) return;

  userInput.value = '';
  btnSend.disabled = true;
  dialogueText.textContent = '...';

  const charId = state.characterId;
  const history = state.history[charId] || [];

  // Record user turn in local history
  history.push({ role: 'user', content: text });

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterId: charId,
        userMessage: text,
        history,
        location: LOCATIONS[state.location]?.name || 'Living Room',
        daypart: DAYPARTS[state.daypartIndex],
        affection: state.affection[charId] || 1
      })
    });

    const data = await res.json();
    handleNPCReply(data.raw || data.text, data.expression);

    // Save assistant reply to history
    history.push({ role: 'assistant', content: data.raw || data.text });
    state.history[charId] = history;
    saveState();
  } catch (err) {
    console.error('Chat error:', err);
    dialogueText.textContent = '[Connection error. Please ensure local LLM is running.]';
  } finally {
    btnSend.disabled = false;
    userInput.focus();
  }
}

function handleNPCReply(rawText, explicitExpression) {
  // Extract expression tag if present: e.g. [smile], [blush], [smug]
  let expression = explicitExpression || 'neutral';
  const match = rawText.match(/^\[([a-zA-Z0-9_-]+)\]/);
  if (match) {
    expression = match[1].toLowerCase();
  }

  updateSprite(expression);

  // Strip leading expression tag for clean reading
  const cleanText = rawText.replace(/^\[[a-zA-Z0-9_-]+\]\s*/, '');
  typeText(cleanText, () => {
    updateQuickReplies();
  });
}

// Time advancing (Daypart loop)
function advanceDaypart() {
  state.daypartIndex++;
  if (state.daypartIndex >= DAYPARTS.length) {
    state.daypartIndex = 0;
    state.day++;
  }
  updateScene();
  updateQuickReplies();
}

function setupEventListeners() {
  // Send message on Enter or click
  btnSend.onclick = () => sendMessage(userInput.value);
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage(userInput.value);
  });

  // Map Modal
  btnMap.onclick = () => {
    renderMapModal();
    mapModal.classList.add('active');
  };
  btnCloseMap.onclick = () => mapModal.classList.remove('active');

  // Actions Modal
  btnActionRow.onclick = () => actionsModal.classList.add('active');
  btnCloseActions.onclick = () => actionsModal.classList.remove('active');

  // Action: Work
  btnDoWork.onclick = () => {
    actionsModal.classList.remove('active');
    state.money += 3500;
    advanceDaypart();
    dialogueText.textContent = `You worked a part-time shift. You earned ¥3,500!`;
    updateSprite('neutral');
  };

  // Action: Gift
  btnDoGift.onclick = () => {
    if (state.money < 1000) {
      alert("You don't have enough money for a gift!");
      return;
    }
    actionsModal.classList.remove('active');
    state.money -= 1000;
    const charId = state.characterId;
    state.affection[charId] = Math.min(5, (state.affection[charId] || 1) + 1);
    renderHUD();
    sendMessage("I brought you a small gift—some fresh pastries from the bakery downtown.");
  };

  // Action: Rest
  btnDoRest.onclick = () => {
    actionsModal.classList.remove('active');
    advanceDaypart();
    dialogueText.textContent = `You rested for a while. Time passes...`;
  };
}

function renderMapModal() {
  mapDestinations.innerHTML = '';
  Object.values(LOCATIONS).forEach(loc => {
    const card = document.createElement('div');
    card.className = 'map-card';
    card.innerHTML = `
      <h4>${loc.name}</h4>
      <p>${loc.defaultChar ? `Resident: ${characters[loc.defaultChar]?.name || loc.defaultChar}` : 'Open Area'}</p>
    `;
    card.onclick = () => {
      state.location = loc.id;
      if (loc.defaultChar) {
        state.characterId = loc.defaultChar;
      }
      mapModal.classList.remove('active');
      updateScene();
      sendMessage(`(You walk into ${loc.name}.)`);
    };
    mapDestinations.appendChild(card);
  });
}

// Start game
init();
