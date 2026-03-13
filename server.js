const express = require('express');
const fs = require('fs');
const path = require('path');

if (process.env.VERCEL !== '1') {
  require('dotenv').config();
}

const { getClipsCollection } = require('./lib/mongodb');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const INDEX_FILE = fs.existsSync(path.join(PUBLIC_DIR, 'index.html'))
  ? path.join(PUBLIC_DIR, 'index.html')
  : path.join(__dirname, 'index.html');
const CLIP_TTL_MS = 2 * 60 * 60 * 1000;
const VALID_TAGS = new Set(['general', 'code', 'link', 'note']);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use('/app.js', express.static(path.join(__dirname, 'app.js')));
app.use('/style.css', express.static(path.join(__dirname, 'style.css')));

app.get('/', (_req, res) => {
  res.sendFile(INDEX_FILE);
});

// ─── Generate unique 4-digit code ─────────────────────────────────────────────
function generateCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function isDuplicateCodeError(error) {
  return error && error.code === 11000;
}

function getStorageErrorMessage(error) {
  if (error instanceof Error && error.message.includes('MONGODB_URI')) {
    return 'Server storage is not configured. Set MONGODB_URI in Vercel or in a local .env file.';
  }

  return 'Storage unavailable. Try again later.';
}

function serializeClip(clip) {
  return {
    code: clip.code,
    title: clip.title,
    content: clip.content,
    tag: clip.tag,
    createdAt: new Date(clip.createdAt).getTime(),
    expiresAt: new Date(clip.expiresAt).getTime(),
    views: clip.views,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/clips — save a clip, returns a 4-digit code
app.post('/api/clips', async (req, res) => {
  const { title, content, tag } = req.body;

  if (!content || typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({ error: 'Content is required.' });
  }
  if (content.length > 50000) {
    return res.status(400).json({ error: 'Content too large (max 50,000 chars).' });
  }

  try {
    const collection = await getClipsCollection();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + CLIP_TTL_MS);
    const sanitizedTitle = (title || '').trim().slice(0, 80);
    const sanitizedTag = VALID_TAGS.has(tag) ? tag : 'general';

    for (let attempt = 0; attempt < 50; attempt++) {
      const code = generateCode();

      try {
        await collection.insertOne({
          code,
          title: sanitizedTitle,
          content: content.trim(),
          tag: sanitizedTag,
          createdAt,
          expiresAt,
          views: 0,
        });

        return res.status(201).json({
          code,
          createdAt: createdAt.getTime(),
          expiresAt: expiresAt.getTime(),
        });
      } catch (error) {
        if (isDuplicateCodeError(error)) {
          continue;
        }

        throw error;
      }
    }

    return res.status(503).json({ error: 'No codes available. Try again later.' });
  } catch (error) {
    console.error('[clips:create]', error);
    return res.status(500).json({ error: getStorageErrorMessage(error) });
  }
});

// GET /api/clips/:code — retrieve a clip by 4-digit code
app.get('/api/clips/:code', async (req, res) => {
  const { code } = req.params;

  if (!/^\d{4}$/.test(code)) {
    return res.status(400).json({ error: 'Invalid code format. Must be 4 digits.' });
  }

  try {
    const collection = await getClipsCollection();
    const clip = await collection.findOne({ code });

    if (!clip) {
      return res.status(404).json({ error: 'No clip found for this code.' });
    }

    if (new Date(clip.expiresAt).getTime() <= Date.now()) {
      await collection.deleteOne({ _id: clip._id });
      return res.status(404).json({ error: 'No clip found for this code.' });
    }

    const nextViews = (clip.views || 0) + 1;
    await collection.updateOne({ _id: clip._id }, { $set: { views: nextViews } });

    return res.json(serializeClip({
      ...clip,
      views: nextViews,
    }));
  } catch (error) {
    console.error('[clips:get]', error);
    return res.status(500).json({ error: getStorageErrorMessage(error) });
  }
});

// DELETE /api/clips/:code — delete a clip
app.delete('/api/clips/:code', async (req, res) => {
  const { code } = req.params;

  if (!/^\d{4}$/.test(code)) {
    return res.status(400).json({ error: 'Invalid code.' });
  }

  try {
    const collection = await getClipsCollection();
    const result = await collection.deleteOne({ code });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Clip not found.' });
    }

    return res.json({ message: 'Clip deleted.' });
  } catch (error) {
    console.error('[clips:delete]', error);
    return res.status(500).json({ error: getStorageErrorMessage(error) });
  }
});

module.exports = app;

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`\n  Clipvault server running at http://localhost:${PORT}\n`);
  });
}
