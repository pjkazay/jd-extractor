// popup.js

const extractBtn  = document.getElementById('extract-btn');
const statusMsg   = document.getElementById('status-msg');
const settingsBtn = document.getElementById('settings-btn');

const dotUrl  = document.getElementById('dot-url');
const dotBox  = document.getElementById('dot-box');
const dotExp  = document.getElementById('dot-exp');

let currentTabId  = null;
let pollInterval  = null;
let isExtracting  = false;

// ── Helpers ──────────────────────────────────────────────────────────────────

function setDot(el, pass) {
  el.className = 'check-dot ' + (pass === null ? 'pending' : pass ? 'pass' : 'fail');
  el.textContent = pass === null ? '–' : pass ? '✓' : '✗';
}

function applyState(state) {
  if (!state) {
    setDot(dotUrl, null);
    setDot(dotBox, null);
    setDot(dotExp, null);
    setButton(false);
    return;
  }

  const urlOk = state.reason !== 'invalid_url';
  const boxOk = urlOk && state.reason !== 'no_text_box';
  const expOk = boxOk && state.reason !== 'not_expanded';

  setDot(dotUrl, urlOk);
  setDot(dotBox, urlOk ? boxOk : null);
  setDot(dotExp, boxOk ? expOk : null);

  setButton(state.active);

  // Contextual hint under the button
  if (!state.active && !isExtracting) {
    if (state.reason === 'invalid_url') {
      showStatus('Navigate to a LinkedIn job posting to use this extension.', 'info');
    } else if (state.reason === 'no_text_box') {
      showStatus('Job description not detected — try scrolling down.', 'info');
    } else if (state.reason === 'not_expanded') {
      showStatus('Click "Show more" to expand the description first.', 'info');
    }
  }
}

function setButton(active) {
  if (isExtracting) return;
  if (active) {
    extractBtn.className = 'active';
    extractBtn.disabled = false;
  } else {
    extractBtn.className = 'inactive';
    extractBtn.disabled = true;
  }
}

function showStatus(msg, type = '') {
  statusMsg.textContent = msg;
  statusMsg.className = type;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    // Fallback for cases where Clipboard API is unavailable
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

// ── State polling ─────────────────────────────────────────────────────────────

async function queryState() {
  if (!currentTabId || isExtracting) return;
  try {
    const state = await chrome.tabs.sendMessage(currentTabId, { type: 'GET_STATE' });
    applyState(state);
  } catch (_) {
    // Content script not reachable (wrong page / not injected yet)
    applyState({ active: false, reason: 'invalid_url' });
  }
}

// ── Extract flow ──────────────────────────────────────────────────────────────

async function handleExtract() {
  if (isExtracting) return;
  isExtracting = true;

  extractBtn.className = 'loading';
  extractBtn.disabled = true;
  extractBtn.textContent = 'Extracting…';
  statusMsg.textContent = '';
  statusMsg.className = '';

  try {
    // 1. Fetch JD text from content script
    const textResponse = await chrome.tabs.sendMessage(currentTabId, { type: 'GET_JD_TEXT' });
    if (textResponse.error) throw new Error(textResponse.error);

    // 2. Send to background for Claude API call
    const apiResponse = await chrome.runtime.sendMessage({
      type: 'EXTRACT_JD',
      text: textResponse.text,
    });

    if (!apiResponse.success) throw new Error(apiResponse.error);

    // 3. Copy to clipboard
    const copied = await copyToClipboard(apiResponse.result);
    showStatus(copied ? 'Copied to clipboard!' : 'Extracted (clipboard write failed).', 'success');
  } catch (err) {
    showStatus(err.message || 'An unexpected error occurred.', 'error');
  } finally {
    isExtracting = false;
    extractBtn.textContent = 'Extract & Copy to Clipboard';
    await queryState(); // restore button state
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  currentTabId = tab.id;

  await queryState();
  pollInterval = setInterval(queryState, 500);
}

// ── Event listeners ───────────────────────────────────────────────────────────

extractBtn.addEventListener('click', handleExtract);

settingsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

window.addEventListener('unload', () => {
  if (pollInterval) clearInterval(pollInterval);
});

init();
