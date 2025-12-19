### Short-term (0-7 days) - Quick

### Mid-Term (1-3 weeks) - User polish

# 2 Context menu integration
Why: Provide right-click menu access to toggle bionic reading without opening popup.
Files: background.js, manifest.json
Tasks:
    Add context menu items for toggle, per-site enable/disable.
    Implement selection-based processing (right-click selected text).
    Add context menu for quick intensity adjustment (Low/Medium/High).
    Store context menu preferences and sync with popup state.
Tests:
    Manual: verify context menu appears, actions work across different page types.
    Integration: ensure context menu state syncs with popup and content script.
Success: right-click menu provides quick bionic reading controls
ETA: 3–4 days

### Long Term Stability & distribution

# 1 Advanced text processing and language support
Why: Extend functionality to non-English text with language-specific processing rules.
Files: content.js, bionic-core.js, new language files
Tasks:
    Add language-specific function word lists (French, German, Spanish articles/prepositions).
    Implement right-to-left text support (Arabic, Hebrew) with proper directional handling.
    Add smart paragraph detection to avoid processing navigation/menu text.
    Create configurable processing rules per language family.
Tests:
    Unit tests: language detection and word classification.
    Manual: test on multilingual sites, RTL content, verify proper text identification.
Success: works correctly on non-English sites with appropriate bolding patterns
ETA: 2–3 weeks

# 2 Chrome Web Store and enterprise distribution
Why: Establish official distribution channel and enterprise deployment capabilities.
Files: manifest.json, new store assets, documentation
Tasks:
    Prepare Chrome Web Store listing with screenshots, descriptions, privacy policy.
    Create enterprise deployment guide with group policy templates.
    Add telemetry (opt-in) for usage analytics and crash reporting.
    Implement auto-update mechanism and version migration scripts.
Tests:
    Store review compliance: security audit, permission justification.
    Enterprise testing: deploy via policy, verify settings sync across organization.
Success: available on Chrome Web Store with 4+ star rating, enterprise deployment ready
ETA: 4–6 weeks

# 3 Cross-browser compatibility and distribution
Why: Expand browser support beyond Chrome/Edge to Firefox and Safari.
Files: manifest.json (v2 version), new build system
Tasks:
    Create Manifest V2 version for Firefox compatibility.
    Adapt Chrome extension APIs to WebExtensions standard.
    Test and package for Firefox Add-ons store and Safari Web Extensions.
    Create unified build system for multi-browser deployment.
Tests:
    Cross-browser testing: verify functionality across Chrome, Firefox, Safari, Edge.
    Store compliance: meet requirements for each browser's extension store.
Success: extension available on Chrome Web Store, Firefox Add-ons, Safari Extensions
ETA: 5–7 weeks
