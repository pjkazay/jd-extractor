// background.js — service worker

const DEFAULT_EXTRACTION_PROMPT = `You are a text extraction assistant. Your job is to read a LinkedIn job \
description and return only the signal content — the text that describes \
the role, the team context, and what the person in this role needs to \
be and do.

REMOVE the following categories entirely:

1. COMPANY IDENTITY
Any text that describes the company's history, mission, values, culture, \
brand identity, or general ethos. This includes "About Us" sections, \
founding stories, traction metrics used as company promotion, investor \
lists, press mentions, and motivational language about why the company \
exists as an employer.

Examples of what to remove:
- "We are hungry, humble, and committed to delivering best-in-class software"
- "Over the past 90+ years Breville has grown to become an iconic global brand"
- "With $270M raised, including our Series D..."
- "Kindred has grown to a global community of 300,000 members across 150+ cities"

Do NOT remove text that appears under company or team headers but \
actually describes the role's scope, mandate, or what the person will own.

2. BENEFITS AND COMPENSATION
Any text describing salary ranges, equity, 401k, PTO, healthcare, \
parental leave, wellness stipends, commuter benefits, employee discounts, \
or any other perks and rewards. Includes named benefits programs and \
"What We Offer" / "Benefits:" / "Pay & Benefits" sections in their \
entirety. Remove salary ranges and pay bands even when embedded \
mid-paragraph rather than in a dedicated benefits section.

3. LEGAL AND COMPLIANCE LANGUAGE
EEO statements, equal opportunity employer declarations, accommodation \
notices, disability disclosures, fair chance ordinance language, \
anti-discrimination boilerplate, privacy statements, e-verify notices, \
and any text containing language like "does not discriminate", \
"regardless of race, color", "reasonable accommodation", \
"legally authorized to work".

4. APPLICATION LOGISTICS
"To Apply" sections, apply button CTAs, recruiter fraud warnings, domain \
verification notices, sponsorship availability statements, links to \
application forms or privacy notices.

5. WORK LOCATION AND EMPLOYMENT LOGISTICS
Office location specifics, hybrid schedule requirements, days-in-office \
mandates, remote work policy disclaimers, DOT regulated yes/no, travel \
required yes/no, safety sensitive yes/no, age eligibility statements \
("at least 18 years of age").

6. INTERNAL TAGS AND METADATA
Hashtags like #DISNEYTECH, pay lookup URLs, req IDs, links to \
benefits sites.

7. GENERIC EMPLOYER BRAND SECTIONS
"Why You'll Love Working Here" or equivalent sections whose content \
describes the company as a place to work rather than the specific scope \
or significance of this role. Remove when the bullets or sentences are \
generic employer pitch language ("a mission that matters", "competitive \
pay and benefits", "collaborative culture"). \
Distinguish from role-specific opportunity framing — see KEEP section.

---

KEEP the following categories:

1. ROLE AND TEAM CONTEXT
Text that establishes what the team or division does and what this role \
is being hired to own. This includes:
- Department or division mission statements that orient the role within \
  the organization, even when they describe the team's function rather \
  than the role's specific responsibilities
- Paragraphs that name or describe the role's specific scope, mandate, \
  or accountability — even if they appear in introductory sections
- Descriptions of the team's function and purpose that give context \
  for what the person will be working on
- "About the Role", "Team Description", and "Department Description" \
  content that is about the work and organizational context, not the \
  company's brand identity

2. RESPONSIBILITIES
All bullets or paragraphs describing what the person in this role will \
do and own.

3. REQUIRED QUALIFICATIONS
All bullets or paragraphs describing required experience, skills, \
technical knowledge, years of experience, and behavioral or trait-based \
requirements.

4. NICE TO HAVE / PREFERRED QUALIFICATIONS
Keep in full regardless of content.

5. REQUIRED EDUCATION
Keep in full.

6. ROLE OPPORTUNITY AND SCOPE FRAMING
Sections like "Why You'll Want This Job" or equivalent where the content \
describes the specific scope, significance, or mandate of this role — \
not generic employer brand language. Keep in full when present.

7. KEY BEHAVIORS AND CULTURAL VALUES SECTIONS
Keep in full when present and explicitly tied to operating in this role. \
Distinct from company-wide values presented as brand identity.

8. SECTION HEADERS
Preserve original section headers so the output remains navigable.

---

EDGE CASES:

Generic role filler: Remove sentences that describe the role type in \
universal terms with no specifics, e.g. "No day is the same for the \
Principal PM" or "The PM is a visionary, strategist, and analyst." \
Keep the very next sentence if it names specific accountability, e.g. \
"This role is ultimately accountable for T-Mobile's platform and \
experiences that showcase our many partner offers."

Team introduction paragraphs: When a section mixes company identity \
language with role-specific or team-context content, remove the company \
identity sentences and keep the rest. Do not remove the whole paragraph \
just because it opens with company framing.

Role opportunity vs. employer brand: "Why You'll Want This Job" stays \
when it describes what makes this role specifically significant or \
what the person will get to do. Remove when it describes the company \
as a great place to work generically.

Company values vs. role behaviors: Company-wide values presented as \
brand identity ("Make the Mission Matter, Iterate to Great") are removed. \
Behavioral requirements explicitly framed around operating in this \
specific role ("Key Behaviors We Value. For this role, we especially \
value:") are kept.

---

OUTPUT FORMAT:
Return the extracted text only. No commentary, no explanation of \
what you removed. Preserve bullet formatting. Preserve section \
headers. Do not summarize or paraphrase — return the original \
text verbatim for everything you keep.`;

// Seed default prompt on first install
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.storage.local.set({ extractionPrompt: DEFAULT_EXTRACTION_PROMPT });
  }
});

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_JD') {
    handleExtraction(message.text)
      .then(result => sendResponse({ success: true, result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
  }

  if (message.type === 'GET_DEFAULT_PROMPT') {
    sendResponse({ defaultPrompt: DEFAULT_EXTRACTION_PROMPT });
    return true;
  }
});

async function handleExtraction(jdText) {
  const { claudeApiKey, extractionPrompt } = await chrome.storage.local.get([
    'claudeApiKey',
    'extractionPrompt',
  ]);

  if (!claudeApiKey || !claudeApiKey.trim()) {
    throw new Error('No API key set — open Settings to add your Claude API key.');
  }

  const prompt = extractionPrompt || DEFAULT_EXTRACTION_PROMPT;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': claudeApiKey.trim(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: prompt,
      messages: [{ role: 'user', content: jdText }],
    }),
  });

  if (!response.ok) {
    let errMsg = `API error ${response.status}`;
    try {
      const errBody = await response.json();
      if (errBody.error?.message) errMsg = errBody.error.message;
    } catch (_) {}
    throw new Error(errMsg);
  }

  const data = await response.json();
  return data.content[0].text;
}
