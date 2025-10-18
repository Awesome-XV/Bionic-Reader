# Terms of Use - Bionic Reader Extension

**Last Updated:** Octob## 6. Privacy and Data Protection

### Commitment to Pri## 7. Compatibility and Limitations

### Supported Environments:
- **Chrome 88+** and other Chromium-based browsers (Brave, Opera, Vivaldi)
- **Microsoft Edge 88+** (Chromium-based)
- **Operating Systems:** Windows, macOS, Linux, Chrome OS
- Standard web pages with HTML text content

### Known Limitations:
- May not work on all websites due to Content Security Policy restrictions
- Some websites may block extension functionality via CSP headers
- Does not work on browser internal pages (chrome://, edge://, about:, etc.)
- Does not work on Chrome Web Store or Edge Add-ons pages
- PDF documents require PDF.js viewer (not native PDF viewer)
- Canvas-rendered text cannot be formatted (e.g., some web games)
- Shadow DOM content may have limited support
- Maximum 3,000 text nodes processed per page for performance

### Performance Considerations:
- Large pages (10,000+ words) may take 1-2 seconds to process
- Dynamic content (SPAs) continuously monitored via MutationObserver
- Processing happens in batches to avoid freezing the page
- Performance monitoring available in console logs (developer mode)

### Browser Compatibility Notes:
- Manifest V3 architecture (modern security standards)
- Service worker background script (non-persistent for efficiency)
- Uses latest Chrome Extension APIs (scripting, storage, tabs)Reader is designed with **privacy-first principles**. We believe your reading activity is personal and private.

### What We DON'T Collect (Guaranteed):
- ❌ Personal information or identity data
- ❌ Browsing history or website URLs visited
- ❌ Website content or text you read
- ❌ User behavior, analytics, or telemetry
- ❌ Passwords, credentials, or sensitive form data
- ❌ IP addresses or device identifiers
- ❌ Cookies or tracking pixels
- ❌ ANY data transmission to external servers

### What We Store Locally (In Your Browser Only):
- ✅ **Extension State:** Your on/off preference (stored in `chrome.storage.sync`)
- ✅ **Intensity Setting:** Your preferred bolding ratio 0-100% (stored in `chrome.storage.sync`)
- ✅ **Optional Statistics:** If enabled, total words processed and reading time (stored in `chrome.storage.local`)
  - These stats NEVER leave your device
  - You can disable stats collection at any time
  - Clearing browser data removes all stats

### Chrome Sync (Optional)
- If you enable Chrome/Edge sync, your intensity preference syncs across your devices
- This uses the browser's built-in sync - we don't have access to it
- Synced data is encrypted by Google/Microsoft, not by us
- You can disable browser sync at any time

### Third-Party Websites:
- This Extension does not control third-party websites
- Website privacy policies apply to the sites you visit
- We are not responsible for third-party data practices
- The Extension only modifies visual presentation, not data collection

### Security Measures
- **Origin Validation:** Blocks dangerous protocols (chrome://, file://, data:)
- **Rate Limiting:** Prevents abuse (100 requests per minute per tab)
- **Input Sanitization:** All text is validated before processing
- **Content Security Policy:** Prevents script injection attacks
- **No eval():** Code does not use dangerous evaluation functionsersion:** 1.1.1  
**Extension ID:** [Available on Chrome Web Store and Microsoft Edge Add-ons]

## 1. Acceptance of Terms

By installing, accessing, or using the Bionic Reader browser extension ("Extension"), you agree to be bound by these Terms of Use ("Terms"). If you do not agree to these Terms, please do not install or use the Extension.

## 2. Description of Service

Bionic Reader is a browser extension (version 1.1.1) that enhances text readability by applying visual formatting techniques to web page content. The Extension:

- Applies bold formatting to the first portion of words based on linguistic patterns
- Distinguishes between function words (articles, prepositions) and content words (nouns, verbs)
- Processes text content locally within your browser using advanced algorithms
- Provides adjustable intensity control (0-100%) for personalized reading experience
- Works on publicly accessible web pages via content script injection
- Provides an on/off toggle and keyboard shortcut (Alt+Shift+B) for user control
- Tracks optional reading statistics (words processed, reading time) locally only

## 3. How the Extension Works

### Technical Architecture
- **Manifest V3 Service Worker:** Modern, secure background script architecture
- **Local Processing Only:** All text processing occurs locally on your device with zero network requests
- **Content Script Injection:** JavaScript is injected into web pages you visit to transform text
- **DOM Manipulation:** The Extension creates `<span>` elements to apply bold formatting
- **Batch Processing:** Processes up to 3,000 text nodes in batches of 100 for performance
- **MutationObserver:** Monitors dynamically loaded content on modern web apps
- **Security Features:** Input sanitization, rate limiting (100 requests/min), origin validation

### What We Access
- **Required Permissions:**
  - `activeTab` - Access the current tab's content only when you click the extension
  - `scripting` - Inject content scripts to transform text
  - `storage` - Save your preferences (intensity, on/off state) locally
  - `tabs` - Communicate between popup and content scripts
  - `host_permissions` (http://*/* and https://*/*) - Access web pages to format text

### What We DON'T Do
- **No Data Collection:** We do not collect, store, or transmit any personal information
- **No Network Requests:** The Extension operates entirely offline (no analytics, no tracking)
- **No Cookies:** We don't use cookies or any tracking mechanisms
- **Temporary Modifications:** Text formatting is temporary and does not permanently alter web pages
- **User Control:** You can enable/disable the Extension at any time

## 4. Permitted Use

You may use this Extension for:
- Personal reading enhancement
- Educational purposes
- Professional reading tasks
- Accessibility assistance

## 5. Prohibited Use

You may NOT use this Extension to:
- Circumvent website security measures
- Violate any applicable laws or regulations
- Interfere with website functionality
- Redistribute or modify the Extension code without permission
- Use the Extension for commercial redistribution without authorization

## 6. Privacy and Data Protection

### What We DON'T Collect:
- Personal information or identity data
- Browsing history or website content
- User behavior or analytics
- Passwords or sensitive information

### What We Store Locally:
- Your on/off preference (stored in browser's local storage)
- Extension settings (stored locally only)

### Third-Party Websites:
- This Extension does not control third-party websites
- Website privacy policies apply to the sites you visit
- We are not responsible for third-party data practices

## 7. Compatibility and Limitations

### Supported Environments:
- Chrome 88+ and other Chromium-based browsers
- Microsoft Edge 88+
- Standard web pages with HTML text content

### Known Limitations:
- May not work on all websites due to technical restrictions
- Some websites may block extension functionality
- Does not work on browser internal pages (chrome://, edge://, etc.)
- PDF documents and non-HTML content are not supported

## 8. Disclaimers and Limitations of Liability

### No Warranty:
- The Extension is provided "AS IS" without warranties of any kind
- We do not guarantee compatibility with all websites
- We do not warrant that the Extension will be error-free or uninterrupted

### Limitation of Liability:
- We are not liable for any damages arising from Extension use
- We are not responsible for website compatibility issues
- Users assume all risks associated with Extension use
- Our liability is limited to the fullest extent permitted by law

## 9. Website Compatibility

### Extension Functionality:
- The Extension modifies the visual presentation of text on web pages
- It does not alter website functionality or data
- Some websites may be incompatible due to technical design
- Certain secure pages may restrict extension access

### User Responsibility:
- Users should respect website terms of service
- Disable the Extension if it conflicts with website functionality
- Report compatibility issues for potential fixes

## 10. Updates and Modifications

### Extension Updates:
- We may update the Extension to improve functionality
- Updates will be distributed through browser extension stores
- Continued use after updates constitutes acceptance of changes

### Terms Updates:
- These Terms may be updated periodically
- Material changes will be communicated through the Extension
- Continued use constitutes acceptance of updated Terms

## 11. Intellectual Property

### Extension Rights:
- The Bionic Reader Extension is protected by copyright
- You may use the Extension according to these Terms
- You may not redistribute or modify without permission

### Third-Party Content:
- The Extension processes content from third-party websites
- We claim no ownership of third-party website content
- Original website content rights remain with respective owners

## 12. Termination

### User Termination:
- You may stop using the Extension at any time by uninstalling it
- Uninstalling removes all local Extension data

### Our Rights:
- We may discontinue the Extension at any time
- We may update or modify functionality as needed
- Critical security updates may be automatically applied

## 13. Geographic Considerations

### International Use:
- The Extension is available globally through browser stores
- Users must comply with local laws and regulations
- Some regions may have restrictions on browser extensions

### Governing Law:
- These Terms are governed by the laws of the jurisdiction where the Extension is developed
- Disputes will be resolved according to applicable local laws

## 14. Accessibility and Support

### Accessibility:
- The Extension is designed to improve text readability
- It may assist users with certain reading difficulties
- The Extension respects browser accessibility settings

### Support:
- Support is provided on a best-effort basis
- Users can report issues through browser extension stores
- We aim to address compatibility and functionality issues promptly

## 15. Open Source and Transparency

### Code Transparency:
- The Extension source code follows open development principles
- Security and privacy can be verified through code review
- We maintain transparency in Extension functionality

### Community:
- User feedback helps improve the Extension
- Feature requests are considered for future updates
- Community contributions may be incorporated with proper attribution

## 16. Contact Information

### Support and Feedback

- **GitHub Repository:** [github.com/Awesome-XV/Bionic-Reader](https://github.com/Awesome-XV/Bionic-Reader)
- **Issue Reporting:** Create an issue on GitHub for bugs or feature requests
- **Extension Store Pages:**
  - Chrome Web Store: [Search for "Bionic Reader"]
  - Microsoft Edge Add-ons: [Search for "Bionic Reader"]
- **Version:** 1.1.1 (October 2025)

### How to Report Issues

1. **Bug Reports:** Include browser version, website URL, and steps to reproduce
2. **Feature Requests:** Describe the desired functionality and use case
3. **Security Issues:** Report privately via GitHub security advisories
4. **Privacy Concerns:** Contact via GitHub issues (we take privacy seriously)

### Community

- **Open Source:** This extension follows open development principles
- **Code Review:** Source code available on GitHub for transparency
- **Contributions:** Pull requests welcome (see CONTRIBUTING.md)
- **License:** MIT License (see LICENSE file)

## 17. Severability

If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect.

## 18. Entire Agreement

These Terms constitute the entire agreement between you and us regarding the Extension and supersede all prior agreements and understandings.

---

## Summary for Users

**In Simple Terms:**
- This Extension helps you read faster by bolding the first part of words
- It uses smart algorithms to distinguish between different word types
- It doesn't collect your data, spy on you, or send anything to servers
- Everything works locally on your device with zero network activity
- You can adjust intensity (0-100%) and turn it on/off anytime
- Use it responsibly and respect website rules
- It's free, open-source, and privacy-focused

**Key Points:**
- ✅ **100% Privacy-Friendly:** Absolutely zero data collection or tracking
- ✅ **Local Processing:** Everything happens on your device
- ✅ **User Control:** You're always in complete control
- ✅ **Free & Open Source:** No hidden costs, subscriptions, or ads
- ✅ **Transparent:** Full source code available on GitHub
- ✅ **Customizable:** Adjust intensity to match your reading preference
- ✅ **Keyboard Shortcut:** Alt+Shift+B to toggle on any page
- ✅ **Optional Stats:** Track your reading progress (locally only)

**Technical Highlights:**
- Manifest V3 architecture (latest security standards)
- Advanced bionic algorithm with linguistic word classification
- Batch processing (up to 3,000 nodes) for performance
- MutationObserver for dynamic content support
- Rate limiting and security validation
- Comprehensive test coverage (200+ tests)

By using the Bionic Reader Extension, you acknowledge that you have read, understood, and agree to these Terms of Use.

---

*Thank you for using Bionic Reader to enhance your reading experience!*