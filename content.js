// content.js — runs on linkedin.com/jobs/* pages

const JOB_VIEW_PATTERN = /linkedin\.com\/jobs\/view\/\d+/;
const TEXT_BOX_SELECTOR = 'span[data-testid="expandable-text-box"]';
const EXPAND_BTN_SELECTOR = 'button[data-testid="expandable-text-button"]';

function getState() {
  const isValidUrl = JOB_VIEW_PATTERN.test(window.location.href);
  if (!isValidUrl) {
    return { active: false, reason: 'invalid_url' };
  }

  const textBox = document.querySelector(TEXT_BOX_SELECTOR);
  if (!textBox) {
    return { active: false, reason: 'no_text_box' };
  }

  const expandBtn = textBox.querySelector(EXPAND_BTN_SELECTOR);
  if (expandBtn) {
    return { active: false, reason: 'not_expanded' };
  }

  return { active: true };
}

function getJdText() {
  const textBox = document.querySelector(TEXT_BOX_SELECTOR);
  return textBox ? textBox.innerText : null;
}

// Respond to popup requests
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_STATE') {
    sendResponse(getState());
    return true;
  }

  if (message.type === 'GET_JD_TEXT') {
    const state = getState();
    if (!state.active) {
      sendResponse({ error: 'Not in active state', state });
      return true;
    }
    const text = getJdText();
    if (!text) {
      sendResponse({ error: 'Could not read job description text.' });
      return true;
    }
    sendResponse({ text });
    return true;
  }
});

// MutationObserver — watches for DOM changes so state stays current
// (popup polls via GET_STATE; observer here handles SPA navigations)
let lastUrl = window.location.href;

const observer = new MutationObserver(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    // URL changed — no action needed beyond updating lastUrl;
    // popup's polling will pick up the new state automatically.
  }
  // DOM changes (expand button appearing/disappearing) are reflected
  // immediately in getState() since it queries the live DOM each call.
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});
