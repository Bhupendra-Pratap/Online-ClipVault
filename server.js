const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const INDEX_FILE = fs.existsSync(path.join(PUBLIC_DIR, 'index.html'))
  ? path.join(PUBLIC_DIR, 'index.html')
  : path.join(__dirname, 'index.html');
const IS_SERVERLESS = process.env.VERCEL === '1';
const DB_FILE = IS_SERVERLESS ? '/tmp/clipvault-data.json' : path.join(__dirname, 'data.json');
const CLIP_TTL_MS = 2 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let memoryDB = {};

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use('/app.js', express.static(path.join(__dirname, 'app.js')));
app.use('/style.css', express.static(path.join(__dirname, 'style.css')));

app.get('/', (_req, res) => {
  res.sendFile(INDEX_FILE);
});

// ─── Persistence Helpers ──────────────────────────────────────────────────────
function loadDB() {
  try {
    if (!fs.existsSync(DB_FILE)) return { ...memoryDB };
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    memoryDB = parsed;
    return parsed;
  } catch {
    return { ...memoryDB };
  }
}

function saveDB(data) {
  memoryDB = data;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    if (!IS_SERVERLESS) {
      throw error;
    }
  }
}

function getExpiresAt(clip) {
  return clip.createdAt + CLIP_TTL_MS;
}

function pruneExpiredClips(db) {
  const now = Date.now();
  let cleaned = 0;

  for (const code of Object.keys(db)) {
    const clip = db[code];
    const expiresAt = getExpiresAt(clip);

    if (now >= expiresAt) {
      delete db[code];
      cleaned++;
      continue;
    }

    if (clip.expiresAt !== expiresAt) {
      clip.expiresAt = expiresAt;
    }
  }

  return cleaned;
}

// ─── Generate unique 4-digit code ─────────────────────────────────────────────
function generateCode(db) {
  const used = new Set(Object.keys(db));
  if (used.size >= 9000) return null; // 1000–9999 range exhausted

  let code;
  let attempts = 0;
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
    attempts++;
    if (attempts > 10000) return null;
  } while (used.has(code));

  return code;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/clips — save a clip, returns a 4-digit code
app.post('/api/clips', (req, res) => {
  const { title, content, tag } = req.body;

  if (!content || typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({ error: 'Content is required.' });
  }
  if (content.length > 50000) {
    return res.status(400).json({ error: 'Content too large (max 50,000 chars).' });
  }

  const db = loadDB();
  pruneExpiredClips(db);
  const code = generateCode(db);
  if (!code) {
    return res.status(503).json({ error: 'No codes available. Try again later.' });
  }

  const createdAt = Date.now();
  const expiresAt = createdAt + CLIP_TTL_MS;

  db[code] = {
    code,
    title: (title || '').trim().slice(0, 80),
    content: content.trim(),
    tag: ['general', 'code', 'link', 'note'].includes(tag) ? tag : 'general',
    createdAt,
    expiresAt,
    views: 0,
  };

  saveDB(db);

  return res.status(201).json({
    code,
    expiresAt,
    createdAt,
  });
});

// GET /api/clips/:code — retrieve a clip by 4-digit code
app.get('/api/clips/:code', (req, res) => {
  const { code } = req.params;

  if (!/^\d{4}$/.test(code)) {
    return res.status(400).json({ error: 'Invalid code format. Must be 4 digits.' });
  }

  const db = loadDB();
  pruneExpiredClips(db);
  const clip = db[code];

  if (!clip) {
    return res.status(404).json({ error: 'No clip found for this code.' });
  }

  // Increment view count
  db[code].views += 1;
  saveDB(db);

  return res.json({
    code: clip.code,
    title: clip.title,
    content: clip.content,
    tag: clip.tag,
    createdAt: clip.createdAt,
    expiresAt: clip.expiresAt,
    views: db[code].views,
  });
});

// DELETE /api/clips/:code — delete a clip
app.delete('/api/clips/:code', (req, res) => {
  const { code } = req.params;

  if (!/^\d{4}$/.test(code)) {
    return res.status(400).json({ error: 'Invalid code.' });
  }

  const db = loadDB();
  pruneExpiredClips(db);
  if (!db[code]) {
    return res.status(404).json({ error: 'Clip not found.' });
  }

  delete db[code];
  saveDB(db);
  return res.json({ message: 'Clip deleted.' });
});

// ─── Cleanup expired clips (runs every 5 minutes) ─────────────────────────────
function cleanupExpiredClips() {
  const db = loadDB();
  const cleaned = pruneExpiredClips(db);
  if (cleaned > 0) {
    saveDB(db);
    console.log(`[cleanup] Removed ${cleaned} expired clip(s)`);
  }
}

module.exports = app;

if (!IS_SERVERLESS) {
  cleanupExpiredClips();
  setInterval(cleanupExpiredClips, CLEANUP_INTERVAL_MS);

  // ─── Start ──────────────────────────────────────────────────────────────────
  app.listen(PORT, () => {
    console.log(`\n  Clipvault server running at http://localhost:${PORT}\n`);
  });
}
