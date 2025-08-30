### Short-term (0-7 days) - Quick

# 1 Nothing yet if you want to suggest anything make an issue 

### Mid-Term (1-3 weeks) - User polish

# 1 Per-site enable + per-site intensity
Why: Users expect site-level preferences; reduces toggling friction.
Files: background.js, popup.js, content.js
Tasks:
    Store settings in chrome.storage.sync keyed by origin (e.g., settings['https://example.com'] = { enabled: true, intensity: 0.5 }).
    Add popup display of current site state and a site-only toggle.
    Add context-menu entry to enable/disable for site from toolbar.
Tests:
    Unit tests: storage read/write helpers.
    Manual: enable on site A, disable on site B — settings persist after reload.
Success: per-site values respected; UI indicates site-specific enabled state
ETA: 3–5 days

### Long Term Stability & distribution

# 1 Publish to Chrome Web Store
Files: README.md, ROADMAP.md, bionic_reader_terms.md
Difficulty: medium
