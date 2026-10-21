// SillyTavern-style Visual Novel Client with Venus Daypart Loop & In-Game Smartphone

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
  },
  smsHistory: {
    rin: [{ from: 'rin', text: "Did you make coffee yet?" }],
    hana: [{ from: 'hana', text: "Good morning! Let me know if you need any study notes 😊" }]
  }
};

let characters = {};
let activePhoneContact = 'rin';

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

// Modals
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

// Phone Elements
const phoneModal = document.getElementById('phone-modal');
const btnPhone = document.getElementById('btn-phone');
const btnClosePhone = document.getElementById('btn-close-phone');
const phoneBackBtn = document.getElementById('phone-back-btn');
const phoneContactsView = document.getElementById('phone-contacts-view');
const phoneThreadView = document.getElementById('phone-thread-view');
const phoneContactName = document.getElementById('phone-contact-name');
const phoneMessagesList = document.getElementById('phone-messages-list');
const phoneInput = document.getElementById('phone-input');
const btnPhoneSend = document.getElementById('btn-phone-send');

async function init() {
  try {
    const res = await fetch('/api/characters');
    const data = await res.json();
    data.forEach(c => { characters[c.id] = c; });
  } catch (err) {
    console.error('Failed to load characters:', err);
  }

  const saved = localStorage.getItem('vn_sandbox_state');
  if (saved) {
    try { state = { ...state, ...JSON.parse(saved) }; } catch (e) {}
  }

  renderHUD();
  updateScene();
  setupEventListeners();

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

  ['morning', 'afternoon', 'evening'].forEach((id, idx) => {
    const dot = document.getElementById(`dp-${id}`);
    if (dot) {
      dot.classList.toggle('active', idx === state.daypartIndex);
    }
  });

  // Update phone preview snippets
  const rinLast = state.smsHistory.rin.slice(-1)[0];
  const hanaLast = state.smsHistory.hana.slice(-1)[0];
  if (rinLast) document.getElementById('preview-rin').textContent = rinLast.text;
  if (hanaLast) document.getElementById('preview-hana').textContent = hanaLast.text;
}

function updateScene() {
  const loc = LOCATIONS[state.location] || LOCATIONS.living_room;
  const isNight = state.daypartIndex === 2;

  const bgUrl = (isNight && loc.bgNight) ? loc.bgNight : loc.bgDay;
  bgLayer.style.backgroundImage = `url('${bgUrl}')`;

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
    btn.onclick = () => { sendMessage(text); };
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
  let expression = explicitExpression || 'neutral';
  const match = rawText.match(/^\[([a-zA-Z0-9_-]+)\]/);
  if (match) {
    expression = match[1].toLowerCase();
  }

  updateSprite(expression);
  const cleanText = rawText.replace(/^\[[a-zA-Z0-9_-]+\]\s*/, '');
  typeText(cleanText, () => {
    updateQuickReplies();
  });
}

// Smartphone SMS logic
function openPhoneThread(charId) {
  activePhoneContact = charId;
  phoneContactName.textContent = characters[charId]?.name || charId;
  phoneContactsView.style.display = 'none';
  phoneThreadView.style.display = 'flex';
  renderPhoneMessages();
}

function renderPhoneMessages() {
  phoneMessagesList.innerHTML = '';
  const msgs = state.smsHistory[activePhoneContact] || [];
  msgs.forEach(m => {
    const bubble = document.createElement('div');
    bubble.className = `msg-bubble ${m.from === 'user' ? 'user' : 'npc'}`;
    bubble.textContent = m.text;
    phoneMessagesList.appendChild(bubble);
  });
  phoneMessagesList.scrollTop = phoneMessagesList.scrollHeight;
}

async function sendPhoneMessage() {
  const text = phoneInput.value.trim();
  if (!text) return;
  phoneInput.value = '';

  const charId = activePhoneContact;
  state.smsHistory[charId].push({ from: 'user', text });
  renderPhoneMessages();

  try {
    const res = await fetch('/api/phone/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterId: charId,
        userMessage: text,
        history: state.smsHistory[charId].map(m => ({
          role: m.from === 'user' ? 'user' : 'assistant',
          content: m.text
        })),
        daypart: DAYPARTS[state.daypartIndex]
      })
    });
    const data = await res.json();
    state.smsHistory[charId].push({ from: charId, text: data.text });
    renderPhoneMessages();
    renderHUD();
    saveState();
  } catch (e) {
    console.error('Phone SMS error:', e);
  }
}

// Time advancing (Daypart loop + Spontaneous SMS triggers)
function advanceDaypart() {
  state.daypartIndex++;
  if (state.daypartIndex >= DAYPARTS.length) {
    state.daypartIndex = 0;
    state.day++;
  }
  updateScene();
  updateQuickReplies();

  // Spontaneous message trigger in the evening
  if (state.daypartIndex === 2) {
    state.smsHistory.rin.push({
      from: 'rin',
      text: "I just finished my drawings. Are you going to be home tonight?"
    });
    renderHUD();
  }
}

function setupEventListeners() {
  btnSend.onclick = () => sendMessage(userInput.value);
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage(userInput.value);
  });

  // Phone Modal
  btnPhone.onclick = () => {
    phoneModal.classList.add('active');
    phoneContactsView.style.display = 'flex';
    phoneThreadView.style.display = 'none';
  };
  btnClosePhone.onclick = () => phoneModal.classList.remove('active');
  phoneBackBtn.onclick = () => {
    phoneThreadView.style.display = 'none';
    phoneContactsView.style.display = 'flex';
  };

  document.querySelectorAll('.phone-chat-item').forEach(item => {
    item.onclick = () => openPhoneThread(item.dataset.char);
  });

  btnPhoneSend.onclick = sendPhoneMessage;
  phoneInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendPhoneMessage();
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

  btnDoWork.onclick = () => {
    actionsModal.classList.remove('active');
    state.money += 3500;
    advanceDaypart();
    dialogueText.textContent = `You worked a part-time shift. You earned ¥3,500!`;
    updateSprite('neutral');
  };

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

init();
