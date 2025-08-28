### Short-term (0-7 days) - Quick

# 1 Instant intensity apply (reliability)
Why: Slider should take effect even if content script isn't injected yet; improves perceived responsiveness.
Files: popup.js, background.js (or popup-inject.js helper)
Tasks:
    Ensure popup injects bionic.css and content.js via chrome.scripting before sending { action: 'setIntensity', intensity }.
    Retry injection with small backoff (2–3 attempts).
    Update popup UI to show friendly fallback when injection fails.
Tests:
Unit tests for injector retry logic (mock chrome.scripting) — already added.
Manual: open an article where extension hasn't been used, move slider → intensity should apply or show fallback.
Success: slider value influences page when enabling without manual toggle; no uncaught errors.
ETA: 1 day

# 2 Live demo preview in popup
Why: Immediate visual feedback increases confidence.
Files: popup.html, popup.js, bionic.css
Tasks:
    Update demo element to re-render using the same transform function (client-side) as slider moves.
    Throttle update to avoid jank in popup (e.g., requestAnimationFrame).
Tests: manual UI test to confirm demo updates on slider input.
Success: demo updates smoothly and reflects intensity.
ETA: 0.5 day

# 3 Accessibility polish
Why: Keyboard users and screen reader users to be supported
Files: popup.html, popup.js
Tasks:
    Ensure role="switch", aria-checked, labels, aria-live for status.
    Add keyboard handlers (Enter/Space) and logical tab order.
    Respect prefers-reduced-motion for animations.
Tests
    Keyboard-only navigation walkthrough.
    Screen reader spot-check (NVDA/VoiceOver).
Success: all controls reachable via tab, aria-live announces state
ETA: 1 day


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
