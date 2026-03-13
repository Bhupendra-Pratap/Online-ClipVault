/* ── State ───────────────────────────────────────────────────────────────────── */
let lastSavedCode = null;
let lastRetrievedCode = null;
let lastRetrievedContent = null;

/* ── Tab switching ───────────────────────────────────────────────────────────── */
function switchTab(tab) {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

  if (tab === 'retrieve') {
    // Auto-fill code from URL param ?code=XXXX
    const urlCode = new URLSearchParams(window.location.search).get('code');
    if (urlCode && /^\d{4}$/.test(urlCode)) {
      fillDigitInputs(urlCode);
    }
    setTimeout(() => document.getElementById('d0').focus(), 80);
  }
}

/* ── Toast ───────────────────────────────────────────────────────────────────── */
let toastTimer;
function showToast(msg, type = 'default') {
  clearTimeout(toastTimer);
  const el = document.getElementById('toast');
  const dot = el.querySelector('.toast-dot');
  document.getElementById('toast-msg').textContent = msg;
  dot.style.background = type === 'error' ? 'var(--red)' : 'var(--green)';
  el.classList.add('show');
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

/* ── Char counter ────────────────────────────────────────────────────────────── */
document.getElementById('content-input').addEventListener('input', function () {
  const len = this.value.length;
  const el = document.getElementById('char-count');
  el.textContent = `${len.toLocaleString()} / 50,000`;
  el.style.color = len > 45000 ? 'var(--red)' : '';
});

/* ── Save clip ───────────────────────────────────────────────────────────────── */
async function saveClip() {
  const content = document.getElementById('content-input').value.trim();
  if (!content) {
    document.getElementById('content-input').focus();
    showToast('Please enter some content.', 'error');
    return;
  }

  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Saving…';

  const payload = {
    title:   document.getElementById('title-input').value.trim(),
    content,
    tag:     document.getElementById('tag-select').value,
  };

  try {
    const res = await fetch('/api/clips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Failed to save.', 'error');
      return;
    }

    lastSavedCode = data.code;
    showCodeResult(data.code, data.expiresAt);

  } catch (err) {
    showToast('Network error. Is the server running?', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 1v8M3 6l4 4 4-4M1 11h12" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      </svg> Generate Code`;
  }
}

/* ── Show code result ────────────────────────────────────────────────────────── */
function showCodeResult(code, expiresAt) {
  // Hide composer, show result
  document.getElementById('composer').style.display = 'none';
  const result = document.getElementById('code-result');
  result.style.display = 'block';

  // Animate digits
  const digits = document.getElementById('code-display');
  digits.innerHTML = code.split('').map(d => `<span>${d}</span>`).join('');

  // Expiry hint
  const hint = document.getElementById('result-expiry');
  if (expiresAt) {
    const d = new Date(expiresAt);
    hint.textContent = `Expires ${d.toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })}`;
  } else {
    hint.textContent = 'Never expires';
  }

  // Update URL silently
  window.history.replaceState({}, '', `?code=${code}`);
}

/* ── Copy code ───────────────────────────────────────────────────────────────── */
function copyCode() {
  if (!lastSavedCode) return;
  navigator.clipboard.writeText(lastSavedCode)
    .then(() => showToast(`Code ${lastSavedCode} copied!`))
    .catch(() => fallbackCopy(lastSavedCode));
}

function shareLink() {
  if (!lastSavedCode) return;
  const url = `${location.origin}${location.pathname}?code=${lastSavedCode}`;
  navigator.clipboard.writeText(url)
    .then(() => showToast('Share link copied!'))
    .catch(() => fallbackCopy(url));
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast('Copied!');
}

/* ── Delete from save tab ────────────────────────────────────────────────────── */
async function deleteCode() {
  if (!lastSavedCode) return;
  try {
    await fetch(`/api/clips/${lastSavedCode}`, { method: 'DELETE' });
    showToast('Clip deleted.');
    resetComposer();
  } catch {
    showToast('Delete failed.', 'error');
  }
}

/* ── Reset composer ──────────────────────────────────────────────────────────── */
function resetComposer() {
  document.getElementById('composer').style.display = 'block';
  document.getElementById('code-result').style.display = 'none';
  document.getElementById('content-input').value = '';
  document.getElementById('title-input').value = '';
  document.getElementById('char-count').textContent = '0 / 50,000';
  lastSavedCode = null;
  window.history.replaceState({}, '', location.pathname);
  document.getElementById('content-input').focus();
}

/* ── Ctrl+Enter to save ──────────────────────────────────────────────────────── */
document.getElementById('content-input').addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') saveClip();
});

/* ── 4-digit input UX ────────────────────────────────────────────────────────── */
const digitIds = ['d0', 'd1', 'd2', 'd3'];

digitIds.forEach((id, i) => {
  const el = document.getElementById(id);

  el.addEventListener('input', function (e) {
    const val = this.value.replace(/\D/g, '');
    this.value = val.slice(-1);  // keep only one digit

    clearError();
    if (val) {
      this.classList.add('filled');
      if (i < 3) document.getElementById(digitIds[i + 1]).focus();
      else checkAutoRetrieve();
    } else {
      this.classList.remove('filled');
    }
  });

  el.addEventListener('keydown', function (e) {
    if (e.key === 'Backspace' && !this.value && i > 0) {
      const prev = document.getElementById(digitIds[i - 1]);
      prev.value = '';
      prev.classList.remove('filled');
      prev.focus();
    }
    if (e.key === 'Enter') retrieveClip();
    if (e.key === 'ArrowLeft' && i > 0) document.getElementById(digitIds[i-1]).focus();
    if (e.key === 'ArrowRight' && i < 3) document.getElementById(digitIds[i+1]).focus();
  });

  // Handle paste of full 4-digit code
  el.addEventListener('paste', function (e) {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
    if (pasted.length >= 4) {
      fillDigitInputs(pasted.slice(0, 4));
      document.getElementById(digitIds[3]).focus();
      checkAutoRetrieve();
    }
  });
});

function fillDigitInputs(code) {
  code.split('').forEach((ch, i) => {
    const el = document.getElementById(digitIds[i]);
    if (el) {
      el.value = ch;
      el.classList.add('filled');
    }
  });
}

function getEnteredCode() {
  return digitIds.map(id => document.getElementById(id).value).join('');
}

function checkAutoRetrieve() {
  const code = getEnteredCode();
  if (code.length === 4) retrieveClip();
}

function clearError() {
  document.getElementById('code-error').textContent = '';
  digitIds.forEach(id => document.getElementById(id).classList.remove('error'));
}

function showError(msg) {
  document.getElementById('code-error').textContent = msg;
  digitIds.forEach(id => document.getElementById(id).classList.add('error'));
}

/* ── Retrieve clip ───────────────────────────────────────────────────────────── */
async function retrieveClip() {
  const code = getEnteredCode();
  if (code.length !== 4) {
    showError('Enter all 4 digits.');
    return;
  }

  clearError();
  const btn = document.getElementById('retrieve-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Loading…';

  document.getElementById('retrieved-card').style.display = 'none';

  try {
    const res = await fetch(`/api/clips/${code}`);
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || 'Not found.');
      return;
    }

    lastRetrievedCode = code;
    lastRetrievedContent = data.content;
    showRetrievedClip(data);

  } catch {
    showError('Network error. Is the server running?');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 13V5M3 8l4-4 4 4M1 3h12" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      </svg> Retrieve`;
  }
}

/* ── Show retrieved clip ─────────────────────────────────────────────────────── */
function showRetrievedClip(data) {
  const card = document.getElementById('retrieved-card');

  document.getElementById('ret-title').textContent = data.title || `Clip #${data.code}`;

  const tagEl = document.getElementById('ret-tag');
  tagEl.textContent = data.tag.toUpperCase();
  tagEl.className = `ret-tag-badge ${data.tag}`;

  document.getElementById('ret-content').textContent = data.content;

  document.getElementById('ret-created').textContent =
    'Created ' + timeAgo(data.createdAt);

  const expEl = document.getElementById('ret-expires');
  if (data.expiresAt) {
    const d = new Date(data.expiresAt);
    expEl.textContent = `Expires ${d.toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })}`;
  } else {
    expEl.textContent = 'Never expires';
  }

  document.getElementById('ret-views').textContent =
    `${data.views} view${data.views !== 1 ? 's' : ''}`;

  card.style.display = 'block';
}

/* ── Copy retrieved content ──────────────────────────────────────────────────── */
function copyRetrieved() {
  if (!lastRetrievedContent) return;
  navigator.clipboard.writeText(lastRetrievedContent)
    .then(() => showToast('Content copied!'))
    .catch(() => fallbackCopy(lastRetrievedContent));
}

/* ── Delete retrieved clip ───────────────────────────────────────────────────── */
async function deleteRetrieved() {
  if (!lastRetrievedCode) return;
  try {
    const res = await fetch(`/api/clips/${lastRetrievedCode}`, { method: 'DELETE' });
    if (res.ok) {
      document.getElementById('retrieved-card').style.display = 'none';
      digitIds.forEach(id => {
        const el = document.getElementById(id);
        el.value = '';
        el.classList.remove('filled', 'error');
      });
      lastRetrievedCode = null;
      lastRetrievedContent = null;
      showToast('Clip deleted.');
    }
  } catch {
    showToast('Delete failed.', 'error');
  }
}

/* ── Utility: time ago ───────────────────────────────────────────────────────── */
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── Auto-load from URL on page open ─────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  const urlCode = new URLSearchParams(window.location.search).get('code');
  if (urlCode && /^\d{4}$/.test(urlCode)) {
    switchTab('retrieve');
  }
});
