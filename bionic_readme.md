# ⚡ Bionic Reader Extension

Transform any webpage text into bionic reading format for faster, more efficient reading. This extension intelligently bolds the first few letters of each word, allowing your brain to auto-complete words and dramatically increase reading speed.

## 🌟 Features

- **Smart Text Processing**: Intelligently bolds text based on word length
- **Content-Aware**: Skips titles, navigation, code, and form elements
- **Security-First**: Built with XSS protection and content validation
- **Enterprise-Grade**: Rate limiting, input sanitization, and audit logging
- **Performance Optimized**: Handles dynamic content without lag
- **Cross-Browser**: Works on Chrome, Edge, and other Chromium browsers
- **Accessibility**: Respects user preferences for motion and contrast

## 📦 Installation Instructions

### Step 1: Download the Extension Files or vist the edge extension store and search "Bionic reader"

1. **Create a new folder** on your computer called `bionic-reader-extension`
2. **Save the following 5 files** in that folder:
   - `manifest.json` - Extension configuration
   - `content.js` - Main text processing logic
   - `background.js` - Secure background service worker
   - `popup.html` - Extension popup interface
   - `bionic.css` - Styling for bionic text

### Step 2: Install in Chrome

1. **Open Chrome** and navigate to `chrome://extensions/`
2. **Enable Developer Mode** by clicking the toggle in the top-right corner
3. **Click "Load unpacked"** button
4. **Select your folder** (`bionic-reader-extension`) and click "Select Folder"
5. **You're done!** You'll see the ⚡ Bionic Reader icon in your toolbar

### Step 3: Install in Microsoft Edge

1. **Open Edge** and navigate to `edge://extensions/`
2. **Enable Developer Mode** by clicking the toggle on the left sidebar
3. **Click "Load unpacked"** button
4. **Select your folder** (`bionic-reader-extension`) and click "Select Folder"
5. **You're done!** The ⚡ icon will appear in your toolbar

## 🚀 How to Use

### Basic Usage

1. **Navigate to any webpage** with text content (articles, blogs, news sites)
2. **Click the ⚡ Bionic Reader icon** in your browser toolbar
3. **Toggle the switch to "ON"** in the popup
4. **Watch the magic happen!** Text transforms instantly
5. **Toggle off anytime** to return to normal reading

### Visual Example

**Before (Normal Text):**
```
Reading this sentence requires your brain to process each complete word
```

**After (Bionic Reading):**
```
Rea**ding th**is sen**tence req**uires yo**ur bra**in t**o pro**cess ea**ch com**plete wo**rd
```
*(Bold parts are what you'll see highlighted)*

## 🎯 Smart Features Explained

### What Gets Processed
- ✅ **Article content** - Main reading text
- ✅ **Blog posts** - Body paragraphs
- ✅ **Comments** - User discussions
- ✅ **Descriptions** - Product details, etc.

### What Gets Skipped
- ❌ **Titles & Headers** (H1, H2, H3, etc.) - Stay clean for scanning
- ❌ **Navigation menus** - UI elements remain unchanged
- ❌ **Code blocks** - Programming code stays readable
- ❌ **Forms & inputs** - No interference with typing
- ❌ **Buttons & labels** - UI text stays normal

## 🛠️ Troubleshooting

### Extension Not Working?

1. **Refresh the page** after installing or enabling
2. **Check if you're on a supported page** - Won't work on:
   - `chrome://` or `edge://` internal pages
   - Extension pages
   - Some secure banking sites
3. **Try a different website** to test functionality

### Toggle Not Responding?

1. **Check the popup status message** - it will tell you if there's an issue
2. **Reload the extension**:
   - Go to `chrome://extensions/`
   - Find Bionic Reader
   - Click the refresh icon
3. **Try refreshing the webpage** and toggle again

### Text Looks Weird?

1. **Toggle off and on again** - This resets the processing
2. **Some websites have custom styling** that might conflict
3. **Check if you're in an iframe** - Some embedded content may not process

## 🔒 Security Features

### Multi-Layer Security Architecture
- **Content Security Policy (CSP)** - Prevents script injection attacks
- **Input Sanitization** - All text is validated and cleaned before processing
- **XSS Protection** - Multiple layers of cross-site scripting prevention
- **Rate Limiting** - Prevents abuse and DoS attacks (100 requests/minute per tab)
- **Origin Validation** - Only allows secure origins and blocks dangerous protocols
- **Audit Logging** - All security events are logged for monitoring

### Secure Processing
- **HTML Escaping** - All user content is escaped to prevent injection
- **Node Validation** - Only safe DOM elements are processed
- **Content Length Limits** - Prevents memory exhaustion attacks (1MB max)
- **Timeout Protection** - Processing is limited to 5 seconds to prevent hanging
- **Batch Limits** - Maximum 100 nodes processed per batch

### Enterprise Compliance
- **No Data Exfiltration** - Everything processes locally, no network requests
- **Zero Tracking** - No user activity monitoring or analytics
- **Secure Storage** - Settings encrypted and validated before use
- **Background Security** - Service worker with enterprise-grade message validation
- **Protocol Blocking** - Automatically blocks `javascript:`, `data:`, and other dangerous URLs

### Security Monitoring
The extension includes built-in security monitoring that:
- Logs all security events to browser console
- Blocks suspicious content automatically  
- Rate limits requests to prevent abuse
- Validates all inter-component communications
- Monitors for injection attempts and blocks them

## 🛡️ Security Validation

### Automatic Threat Detection
The extension automatically detects and blocks:
- **Script Injection** - `<script>` tags and JavaScript URLs
- **HTML Injection** - Malicious HTML elements
- **Protocol Attacks** - `javascript:`, `data:`, `vbscript:` schemes
- **Event Handler Injection** - `onclick`, `onload`, etc. attributes
- **Size Attacks** - Oversized content that could crash the browser

### Safe by Design
- Only processes text content in safe HTML elements
- Never executes user-provided JavaScript
- Validates all transformations before applying them
- Uses secure DOM manipulation methods only
- Implements defense-in-depth security principles

## ⚙️ Technical Details

### File Structure
```
bionic-reader-extension/
├── manifest.json      # Extension configuration
├── content.js        # Text processing logic
├── background.js     # Secure service worker
├── popup.html        # User interface
└── bionic.css        # Text styling
```

### Browser Compatibility
- ✅ **Chrome** 88+ (Manifest V3)
- ✅ **Microsoft Edge** 88+
- ✅ **Brave Browser**
- ✅ **Other Chromium-based browsers**

### Performance & Security
- **Minimal memory usage** - Only processes visible text with strict limits
- **Efficient DOM handling** - Batch processing for large pages (max 100 nodes)
- **Throttled updates** - Smooth performance on dynamic content
- **Enterprise Security** - Rate limiting (100 req/min), XSS protection, audit logging
- **Timeout Protection** - Processing limited to 5 seconds to prevent hangs
- **Content Validation** - All text sanitized and validated before processing

## 🆘 Support & Issues

### Common Questions

**Q: Why doesn't it work on some websites?**
A: Some sites use complex layouts or security restrictions that don't allow for the extesnion to read. Try refreshing or check if it's a restricted page type.

**Q: Can I adjust the bolding amount?**
A: Currently uses smart defaults based on word length. Future versions may include customization.

**Q: Does it work on PDFs?**
A: Only works on web pages with HTML text, not PDF documents.

**Q: How do I verify the extension is secure?**
A: Check the browser console (F12) for security logs, all validation and blocking events are logged with '[Security]' prefix.

**Q: Is this extension safe for enterprise use?**
A: Yes! Built with enterprise-grade security including CSP, rate limiting, input sanitization, XSS protection, and comprehensive audit logging.

**Q: What security measures are in place?**
A: Multi-layer security including content validation, origin checking, HTML escaping, timeout protection, and automatic threat detection.

**Q: Does it work in corporate environments?**
A: Yes, designed for corporate security policies with no network requests, local processing only, and comprehensive security logging.

### Getting Help

If you encounter issues:

1. **Check this troubleshooting guide first**
2. **Try the basic fixes** (refresh page, reload extension)
3. **Test on a simple website** like Wikipedia to isolate the issue
4. **Note your browser version** and the specific website where it fails
5. **If it still doesn't work make sure that you sumbit a issue on the github repo**

## 🔄 Updates & Maintenance

### Updating the Extension

1. **Download new files** when updates are available
2. **Replace old files** in your extension folder
3. **Reload the extension** in `chrome://extensions/`
4. **Refresh any open tabs** to use the new version

### Manual Removal

To completely remove the extension:

1. Go to `chrome://extensions/` or `edge://extensions/`
2. Find "Bionic Reader" in the list
3. Click "Remove" button
4. Delete the extension folder from your computer

---

## 📖 About Bionic Reading

Bionic Reading is a reading method that highlights the first few letters of words, allowing your brain to complete them automatically. This technique can:

- **Increase reading speed** by up to 30-50%
- **Improve focus** and concentration
- **Reduce eye strain** during long reading sessions  
- **Help with dyslexia** and reading difficulties
- **Make dense content** more digestible

**Happy speed reading!** 🚀⚡