# Bionic Reader

This is a tool designed to enhance reading speed and comprehension by highlighting parts of words to guide the reader's eye.

## Description

Bionic Reader transforms normal text into a format where the initial letters of each word are emphasized, helping the reader to focus and process text more efficiently. This method can potentially increase reading speed and comprehension by reducing the time the brain needs to process each word.

Transform any webpage text into bionic reading format for faster, more efficient reading. This extension intelligently bolds the first few letters of each word, allowing your brain to auto-complete words and dramatically increase reading speed.

## 🌟 Features

- Convert regular text to bionic reading format
- Adjustable highlighting intensity
- Support for different languages
- Easy integration with other applications

Additional features include:
- Smart Text Processing: Intelligently bolds text based on word length
- Content-Aware: Skips titles, navigation, code, and form elements
- Security-First: Built with XSS protection and content validation
- Enterprise-Grade: Rate limiting, input sanitization, and audit logging
- Performance Optimized: Handles dynamic content without lag
- Cross-Browser: Works on Chrome, Edge, and other Chromium browsers
- Accessibility: Respects user preferences for motion and contrast

## 📦 Installation Instructions

# Installation thorugh marketplace ONLY AVAILABLE FOR EDGE

### Step 1: Download
- Vist the edge market place and downlaod the extension 
- Use it!

# If using developer packages

```
# Clone the repository
git clone https://github.com/yourusername/Bionic-Reader.git

# Navigate to the project directory
cd Bionic-Reader

# Install dependencies
npm install
```

### Step 1: Download the Extension Files
- Clone this repository or download the files
- The repository contains:
  - manifest.json - Extension configuration
  - content.js - Main text processing logic
  - background.js - Secure background service worker
  - popup.html - Extension popup interface
  - bionic.css - Styling for bionic text

### Step 2: Install in Chrome
1. Open Chrome and navigate to chrome://extensions/
2. Enable Developer Mode by clicking the toggle in the top-right corner
3. Click "Load unpacked" button
4. Select your folder and click "Select Folder"
5. You're done! You'll see the ⚡ Bionic Reader icon in your toolbar

### Step 3: Install in Microsoft Edge
1. Open Edge and navigate to edge://extensions/
2. Enable Developer Mode by clicking the toggle on the left sidebar
3. Click "Load unpacked" button
4. Select your folder and click "Select Folder"
5. You're done! The ⚡ icon will appear in your toolbar

## 🚀 Usage

```javascript
// Example usage of the Bionic Reader
const bionicReader = new BionicReader();
const normalText = "This is a sample text to demonstrate bionic reading.";
const bionicText = bionicReader.convert(normalText);
```

### How to Use
1. Navigate to any webpage with text content
2. Click the ⚡ Bionic Reader icon in your browser toolbar
3. Toggle the switch to "ON" in the popup
4. Watch the magic happen! Text transforms instantly
5. Toggle off anytime to return to normal reading

## Demo

Before (normal):

Reading this sentence requires your brain to process each complete word.

After (Bionic):

**Rea**ding **th**is **se**ntence **re**quires **yo**ur **br**ain **to** **pr**ocess **ea**ch **co**mplete **wo**rd.

Quick try:

- Open any article-like page and click the extension icon.
- Toggle On to apply bionic highlighting.
- Use the "Highlight intensity" slider to make highlighting stronger or gentler.
- Press Ctrl+Shift+B (Cmd+Shift+B on Mac) to toggle the extension from the keyboard.

## 🎯 Smart Features Explained

### What Gets Processed
- ✅ Article content - Main reading text
- ✅ Blog posts - Body paragraphs
- ✅ Comments - User discussions
- ✅ Descriptions - Product details, etc.

### What Gets Skipped
- ❌ Titles & Headers - Stay clean for scanning
- ❌ Navigation menus - UI elements remain unchanged
- ❌ Code blocks - Programming code stays readable
- ❌ Forms & inputs - No interference with typing
- ❌ Buttons & labels - UI text stays normal

## 🛠️ Technical Implementation

The extension consists of these key components:

- content.js: The main script that analyzes and processes webpage text to apply bionic reading formatting.
- background.js: A secure service worker that handles messaging between components with robust security measures.
- popup.html and popup.js: The user interface for toggling the extension.
- bionic.css: Styling for the bionic text with extensive compatibility for various websites.
- manifest.json: Configuration file defining permissions and extension structure.

## 🔒 Security Features

- Content Security Policy (CSP) - Prevents script injection attacks
- Input Sanitization - All text is validated and cleaned before processing
- XSS Protection - Multiple layers of cross-site scripting prevention
- Rate Limiting - Prevents abuse (100 requests/minute per tab)
- Origin Validation - Only allows secure origins and blocks dangerous protocols
- Audit Logging - Security events are logged for monitoring

## 🛡️ Privacy Considerations

- No Data Collection: All processing happens locally
- Zero Tracking: No user activity monitoring or analytics
- Secure Storage: Settings encrypted and validated before use
- No Network Requests: Works completely offline
- Protocol Blocking: Blocks dangerous URLs automatically

## 🆘 Troubleshooting

### Extension Not Working?
- Refresh the page after installing or enabling
- Check if you're on a supported page - Won't work on browser internal pages
- Try a different website to test functionality

### Toggle Not Responding?
- Check the popup status message - it will tell you if there's an issue
- Reload the extension through the extensions page
- Try refreshing the webpage and toggle again

## 📖 About Bionic Reading

Bionic Reading is a reading method that highlights the first few letters of words, allowing your brain to complete them automatically. This technique can:

- Increase reading speed by up to 30-50%
- Improve focus and concentration
- Reduce eye strain during long reading sessions
- Help with dyslexia and reading difficulties
- Make dense content more digestible

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

Happy speed reading! 🚀⚡
