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
  // CORS headers
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

  // API: Chat completion (SillyTavern style with expression tagging)
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

        // System prompt crafting (SillyTavern style)
        const systemPrompt = `[Character Roleplay]\n` +
          `You are roleplaying as ${character.name}.\n` +
          `Persona: ${character.personality}\n` +
          `Scenario: ${character.scenario}\n` +
          `Current Setting: ${location}, during the ${daypart}.\n` +
          `Affection Level with Player: Level ${affection} / 5.\n\n` +
          `Instructions:\n` +
          `- Stay strictly in character as ${character.name}.\n` +
          `- Respond in vivid, atmospheric, first-person visual novel dialogue and narration.\n` +
          `- ALWAYS start your response with a bracketed expression tag from this list to control your on-screen visual novel sprite:\n` +
          `  [neutral], [smile], [smug], [blush], [embarrassed], [surprised], [frustrated]\n` +
          `- If your expression shifts during the reply, you may include another tag like [blush] before that line.\n` +
          `- Be charming, responsive, and natural. Do NOT output JSON or lists. Just roleplay.`;

        const messages = [
          { role: 'system', content: systemPrompt },
          ...history.slice(-8), // Keep recent turns for high-speed local inference
          { role: 'user', content: userMessage }
        ];

        // Call local LLM (LM Studio / Ollama / OpenAI format)
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
          // Graceful fallback if local model is offline
          replyText = `[smile] "${character.dialogueExamples?.[0] || 'Hello! (Note: Local model at http://localhost:1234/v1 is not running yet. Start LM Studio to enable real AI generation!)'}"`;
        }

        // Parse leading expression tag if present
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
