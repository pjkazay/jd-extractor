// options.js

// ── Elements ──────────────────────────────────────────────────────────────────

const apiKeyInput      = document.getElementById('api-key-input');
const toggleVisBtn     = document.getElementById('toggle-vis-btn');
const saveKeyBtn       = document.getElementById('save-key-btn');
const saveKeyStatus    = document.getElementById('save-key-status');

const promptTextarea   = document.getElementById('prompt-textarea');
const lockBadge        = document.getElementById('lock-badge');
const toggleLockBtn    = document.getElementById('toggle-lock-btn');
const savePromptBtn    = document.getElementById('save-prompt-btn');
const resetPromptBtn   = document.getElementById('reset-prompt-btn');
const savePromptStatus = document.getElementById('save-prompt-status');

// ── State ─────────────────────────────────────────────────────────────────────

let promptLocked = true;
let keyVisible   = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

function showStatus(el, msg, type, durationMs = 2500) {
  el.textContent = msg;
  el.className = type;
  setTimeout(() => {
    el.textContent = '';
    el.className = '';
  }, durationMs);
}

function setLock(locked) {
  promptLocked = locked;
  promptTextarea.disabled = locked;
  lockBadge.textContent = locked ? 'Locked' : 'Unlocked';
  lockBadge.className = 'lock-badge ' + (locked ? 'locked' : 'unlocked');
  toggleLockBtn.textContent = locked ? 'Unlock to edit' : 'Lock';
  savePromptBtn.disabled = locked;
}

// ── Load saved values ─────────────────────────────────────────────────────────

async function loadSettings() {
  const { claudeApiKey, extractionPrompt } = await chrome.storage.local.get([
    'claudeApiKey',
    'extractionPrompt',
  ]);

  if (claudeApiKey) {
    apiKeyInput.value = claudeApiKey;
  }

  if (extractionPrompt) {
    promptTextarea.value = extractionPrompt;
  }
}

// ── API Key handlers ──────────────────────────────────────────────────────────

toggleVisBtn.addEventListener('click', () => {
  keyVisible = !keyVisible;
  apiKeyInput.type = keyVisible ? 'text' : 'password';
  toggleVisBtn.textContent = keyVisible ? 'Hide' : 'Show';
});

saveKeyBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showStatus(saveKeyStatus, 'Enter an API key first.', 'error');
    return;
  }
  await chrome.storage.local.set({ claudeApiKey: key });
  showStatus(saveKeyStatus, 'Saved!', 'success');
});

// ── Prompt handlers ───────────────────────────────────────────────────────────

toggleLockBtn.addEventListener('click', () => {
  setLock(!promptLocked);
});

savePromptBtn.addEventListener('click', async () => {
  const prompt = promptTextarea.value.trim();
  if (!prompt) {
    showStatus(savePromptStatus, 'Prompt cannot be empty.', 'error');
    return;
  }
  await chrome.storage.local.set({ extractionPrompt: prompt });
  setLock(true);
  showStatus(savePromptStatus, 'Saved!', 'success');
});

resetPromptBtn.addEventListener('click', async () => {
  if (!confirm('Reset the extraction prompt to the built-in default? This cannot be undone.')) return;

  // Ask background for default — simplest approach is to clear the stored key
  // so background.js falls back to DEFAULT_EXTRACTION_PROMPT on next call,
  // but we also want to display it. Fetch it from background via a message.
  const response = await chrome.runtime.sendMessage({ type: 'GET_DEFAULT_PROMPT' });
  const defaultPrompt = response?.defaultPrompt || '';

  await chrome.storage.local.set({ extractionPrompt: defaultPrompt });
  promptTextarea.value = defaultPrompt;
  setLock(true);
  showStatus(savePromptStatus, 'Reset to default.', 'success');
});

// ── Init ──────────────────────────────────────────────────────────────────────

loadSettings();
