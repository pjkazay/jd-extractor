# JD Extractor

A Chrome extension that strips boilerplate from LinkedIn job descriptions and copies only the signal content to your clipboard using the Claude API.

**Removes:** company mission/values, benefits, EEO statements, application logistics, internal tags, generic employer branding.

**Keeps:** role context, responsibilities, required qualifications, preferred qualifications, education requirements, and section headers — verbatim.

---

## How it works

1. Navigate to a LinkedIn job posting (`linkedin.com/jobs/view/<id>`)
2. Click **"Show more"** to fully expand the job description
3. Click the extension icon — all three checklist indicators should show ✓
4. Click **Extract & Copy to Clipboard**
5. Paste anywhere

The popup shows a live checklist:

| Indicator | Meaning |
|---|---|
| LinkedIn job view URL | You're on a job detail page, not search results |
| Job description found | The description element is present on the page |
| Description expanded | "Show more" has been clicked |

The button activates only when all three are green.

---

## Installation (Developer Mode)

1. Clone this repo:
   ```bash
   git clone https://github.com/pjkazay/jd-extractor.git
   cd jd-extractor
   ```

2. Generate the placeholder icons (one-time):
   ```bash
   node icons/create_icons.js
   ```

3. Open Chrome → `chrome://extensions`
4. Enable **Developer mode** (top-right toggle)
5. Click **Load unpacked** → select the `jd-extractor` folder
6. The extension icon appears in your toolbar

> After editing any source file, hit the **reload icon** on the extension card in `chrome://extensions`. If you edited `content.js`, also reload the LinkedIn tab.

---

## Setup

1. Click the ⚙ icon in the popup (or right-click the extension → **Options**)
2. Paste your [Anthropic API key](https://console.anthropic.com) and click **Save Key**

**Your API key is:**
- Stored only in `chrome.storage.local` on your machine
- Never embedded in any source file
- Sent exclusively to `api.anthropic.com` when you trigger an extraction
- Never logged, synced, or shared

---

## Customizing the extraction prompt

The Settings page exposes the full system prompt sent to Claude.

- Locked by default — click **Unlock to edit** to modify
- Click **Save Prompt** to persist changes
- Click **Reset to Default** to restore the built-in prompt

---

## Technical notes

- **Manifest V3** service worker architecture
- Claude API calls are made from `background.js` (the service worker), not the content script — avoids CORS issues and keeps the API key out of page context
- No external libraries or bundlers — vanilla JS only
- Model: `claude-sonnet-4-20250514`, max 4000 output tokens
- State detection uses a MutationObserver in the content script + 500ms polling from the popup, so the button activates the moment you expand the description

---

## Chrome Web Store

Not yet published. To submit:

1. Replace the placeholder icons in `icons/` with proper 16×16, 48×48, and 128×128 PNG artwork
2. Write a short privacy policy (required — note that the API key is stored locally only)
3. Zip the extension folder (exclude `.git` and `node_modules`)
4. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
5. Pay the one-time $5 developer fee if not already registered
6. Upload the ZIP and fill in the listing (screenshots, description, category: **Productivity**)
7. In the **permissions justification** field, note: "`api.anthropic.com` is used exclusively to call the Claude API for job description text extraction"
8. Submit for review (typically 1–3 business days)
