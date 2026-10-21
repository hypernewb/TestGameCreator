# Tokyo After Hours — Visual Novel Sandbox

A clean, playable adult Visual Novel Sandbox combining **SillyTavern-style natural roleplay** with **Venus University's visual presentation and daypart loop**.

---

## Why This Architecture Works

Traditional visual novel engines use hardcoded branching scripts, while pure chat UIs (like SillyTavern) lack visual novel staging, sprite expressions, and persistent day-to-day gameplay.

This project merges the best of both worlds:
1. **SillyTavern Roleplay Core:** The LLM is never forced to output complex database JSON schemas or track rigid state variables. Instead, it gets rich character cards and system prompts, producing witty, emotional, flirty dialogue.
2. **Visual Novel Stage:** Characters have on-screen sprites that dynamically shift expressions (`[neutral]`, `[smile]`, `[smug]`, `[blush]`, `[embarrassed]`, `[frustrated]`) based on tags in the LLM's response.
3. **Venus Daypart Loop:** Time moves through three dayparts: **Morning**, **Afternoon**, and **Evening**. Travel on the map is free; working a shift or resting advances the clock.
4. **Zero Dependencies:** Built with vanilla modern JavaScript and native Node.js (no heavy build steps, no webpack, no fragile frameworks).

---

## Quick Start

### 1. Start your Local LLM
Ensure your local LLM server (LM Studio, Ollama, or llama.cpp) is running an OpenAI-compatible API endpoint:
* **Default URL:** `http://localhost:1234/v1`
* **Recommended Models:** Any 8B–14B RP/NSFW roleplay model (e.g. `Qwen 2.5 7B/14B Instruct`, `Llama 3.1 8B Instruct`, `Stheno`, etc.).

### 2. Launch the Game Server
From this project directory:
```bash
node server.mjs
```

### 3. Open in Browser
Navigate to:
```
http://localhost:3000
```

*(Note: Even if your local LLM is offline, the game will load and use built-in dialogue fallbacks so you can test the UI and daypart flow immediately!)*

---

## Project Structure

```
├── characters/                # SillyTavern-style Character Cards
│   ├── rin.json               # Rin (29, architect flatmate, kuudere with private passion)
│   └── hana.json              # Hana (22, sweet university student flatmate)
├── public/                    # Frontend Visual Novel Client
│   ├── index.html             # Main game layout (HUD, Stage, ADV dialogue box)
│   ├── app.js                 # Game state, Daypart loop, Sprite swapper, Chat client
│   ├── style.css              # Glassmorphism ADV box & Japanese VN aesthetics
│   └── assets/                # Sprites, expressions, CG scenes, and backgrounds
│       ├── characters/        # Expressions & full-body renders (Rin, Hana)
│       └── places/            # Location backgrounds (Diner, Bedroom, Station, Hotel)
├── server.mjs                 # Native Node.js web & LLM proxy server
└── package.json               # Project manifest
```

---

## How It Works Under the Hood

### Dynamic Sprite Expression Pipeline
When the LLM speaks, it includes an expression tag at the beginning of its response:
```text
[blush] "If you're going to stand this close to me, the least you could do is make yourself useful..."
```
The client (`public/app.js`):
1. Detects `[blush]`.
2. Seamlessly fades the character sprite to `assets/characters/rin/expressions/embarrassed.png`.
3. Strips the tag and displays the clean dialogue text in the typewriter ADV dialogue box.

### Adding New Characters
To add another girl, simply create a new JSON file in `characters/<id>.json`:
```json
{
  "id": "mai",
  "name": "Mai",
  "role": "Diner Owner",
  "personality": "Playful, confident, mature...",
  "scenario": "Behind the counter at her small diner...",
  "systemPrompt": "You are roleplaying as Mai...",
  "sprites": {
    "neutral": "assets/characters/mai/neutral.png",
    "smile": "assets/characters/mai/smile.png",
    "blush": "assets/characters/mai/blush.png"
  }
}
```

---

## Controls & Gameplay
* **Free Movement:** Open the **Map** to travel between rooms and locations freely.
* **Daily Actions:** Click **Actions** to work a part-time shift (+¥3,500), buy a gift to boost affection, or pass time to the next daypart.
* **Roleplay:** Use the free-text input box at the bottom to say or do whatever you want, or click the contextual reply chips for quick responses.
