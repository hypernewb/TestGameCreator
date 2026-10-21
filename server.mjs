import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const LLM_ENDPOINT = process.env.LLM_ENDPOINT || 'http://localhost:1234/v1/chat/completions';
const LLM_MODEL = process.env.LLM_MODEL || 'local-model';

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// Load Lorebook entries
function getRelevantLore(text) {
  try {
    const lorePath = path.join(__dirname, 'lorebook.json');
    if (!fs.existsSync(lorePath)) return '';
    const loreList = JSON.parse(fs.readFileSync(lorePath, 'utf8'));
    const lower = (text || '').toLowerCase();

    const matched = loreList.filter(item => {
      return item.keys.some(k => lower.includes(k.toLowerCase()));
    });

    if (matched.length === 0) return '';
    return '\n[World Lore & Knowledge]\n' + matched.map(m => `- ${m.content}`).join('\n') + '\n';
  } catch (e) {
    return '';
  }
}

function serveStatic(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // API: Get character list
  if (pathname === '/api/characters' && req.method === 'GET') {
    try {
      const charsDir = path.join(__dirname, 'characters');
      const files = fs.readdirSync(charsDir).filter(f => f.endsWith('.json'));
      const list = files.map(file => {
        const raw = fs.readFileSync(path.join(charsDir, file), 'utf8');
        return JSON.parse(raw);
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(list));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // API: Get Lorebook entries
  if (pathname === '/api/lorebook' && req.method === 'GET') {
    try {
      const lorePath = path.join(__dirname, 'lorebook.json');
      const raw = fs.existsSync(lorePath) ? fs.readFileSync(lorePath, 'utf8') : '[]';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(raw);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // API: Phone SMS Chat (Shorter, casual messaging format)
  if (pathname === '/api/phone/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { characterId, userMessage, history = [], daypart = 'Evening' } = payload;

        const charPath = path.join(__dirname, 'characters', `${characterId}.json`);
        if (!fs.existsSync(charPath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Character not found' }));
          return;
        }

        const character = JSON.parse(fs.readFileSync(charPath, 'utf8'));
        const lore = getRelevantLore(userMessage);

        const systemPrompt = `[Smartphone Messaging / SMS]\n` +
          `You are roleplaying as ${character.name} texting the player on her phone.\n` +
          `Persona: ${character.personality}\n` +
          `Current Time: ${daypart}.\n` +
          `${lore}\n` +
          `Instructions:\n` +
          `- Respond as an SMS text message (1 to 3 short sentences).\n` +
          `- Use natural texting style suited to her personality (emojis, casual grammar, direct tone).\n` +
          `- Do NOT use expression tags or asterisk actions like *smiles*. Just output her text message.`;

        const messages = [
          { role: 'system', content: systemPrompt },
          ...history.slice(-6),
          { role: 'user', content: userMessage }
        ];

        let reply = '';
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 30000);
          const llmRes = await fetch(LLM_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: LLM_MODEL, messages, temperature: 0.8, max_tokens: 150 }),
            signal: controller.signal
          });
          clearTimeout(timeout);
          if (llmRes.ok) {
            const data = await llmRes.json();
            reply = data.choices?.[0]?.message?.content || 'Read 10:14 PM';
          } else {
            throw new Error(`Status ${llmRes.status}`);
          }
        } catch (e) {
          reply = character.id === 'rin' ? "I'm still finishing up some drawings. See you at home later." : "Got your message! Let's talk more when you get back 😊";
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ text: reply.trim(), from: character.name }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: Visual Novel Scene Chat (SillyTavern style with expression tagging & Lorebook injection)
  if (pathname === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { characterId, userMessage, history = [], location = 'Living Room', daypart = 'Morning', affection = 1 } = payload;

        const charPath = path.join(__dirname, 'characters', `${characterId}.json`);
        if (!fs.existsSync(charPath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Character ${characterId} not found` }));
          return;
        }

        const character = JSON.parse(fs.readFileSync(charPath, 'utf8'));

        // Inject Lorebook entries triggered by message or location
        const lore = getRelevantLore(`${userMessage} ${location}`);

        const systemPrompt = `[Character Roleplay]\n` +
          `You are roleplaying as ${character.name}.\n` +
          `Persona: ${character.personality}\n` +
          `Scenario: ${character.scenario}\n` +
          `Current Setting: ${location}, during the ${daypart}.\n` +
          `Affection Level with Player: Level ${affection} / 5.\n` +
          `${lore}\n` +
          `Instructions:\n` +
          `- Stay strictly in character as ${character.name}.\n` +
          `- Respond in vivid, atmospheric, first-person visual novel dialogue and narration.\n` +
          `- ALWAYS start your response with a bracketed expression tag from this list to control your on-screen visual novel sprite:\n` +
          `  [neutral], [smile], [smug], [blush], [embarrassed], [surprised], [frustrated]\n` +
          `- If your expression shifts during the reply, you may include another tag like [blush] before that line.\n` +
          `- Be charming, responsive, and natural. Do NOT output JSON or lists. Just roleplay.`;

        const messages = [
          { role: 'system', content: systemPrompt },
          ...history.slice(-8),
          { role: 'user', content: userMessage }
        ];

        let replyText = '';
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 45000);

          const llmRes = await fetch(LLM_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: LLM_MODEL,
              messages,
              temperature: 0.8,
              max_tokens: 600
            }),
            signal: controller.signal
          });
          clearTimeout(timeout);

          if (llmRes.ok) {
            const data = await llmRes.json();
            replyText = data.choices?.[0]?.message?.content || '[smile] "...?"';
          } else {
            throw new Error(`LLM status ${llmRes.status}`);
          }
        } catch (llmErr) {
          replyText = `[smile] "${character.dialogueExamples?.[0] || 'Hello! (Note: Local model at http://localhost:1234/v1 is not running yet. Start LM Studio to enable real AI generation!)'}"`;
        }

        let expression = 'neutral';
        const match = replyText.match(/^\[([a-zA-Z0-9_-]+)\]/);
        if (match) {
          expression = match[1].toLowerCase();
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          raw: replyText,
          expression,
          text: replyText.replace(/^\[[a-zA-Z0-9_-]+\]\s*/, ''),
          characterName: character.name
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Static files from /public
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';
  const fullPath = path.join(__dirname, 'public', safePath);

  serveStatic(req, res, fullPath);
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`  SillyTavern Visual Novel Sandbox`);
  console.log(`  Server running at: http://localhost:${PORT}`);
  console.log(`  Connected to LLM:  ${LLM_ENDPOINT}`);
  console.log(`==================================================\n`);
});
