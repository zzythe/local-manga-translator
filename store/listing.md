# Store listing: Local Manga Translator

Use the same text on the Chrome Web Store, Microsoft Edge Add-ons and Firefox Add-ons.

## Name
Local Manga Translator

## Short description (Chrome: 132 characters max)
Translate manga, manhwa and manhua right on the page with AI that runs on your own PC. Private, no account, free to start.

## Category
Chrome: **Tools** (Productivity). Edge: **Productivity**. Firefox: **Language Support**.

## Description

Read raw manga, manhwa and manhua in your language, right on the page you're on.

Local Manga Translator finds the text in speech bubbles, captions and sound effects, cleans it out of the art, and letters the translation back in to fit each bubble. Pages ahead of you are translated while you read, so you can just keep scrolling.

★ PRIVATE: the AI runs on your own computer
Pages are read by a vision model running in Ollama, a free program on your PC. Nothing you read is uploaded, there's no account, and there are no analytics.

★ WORKS ON THE READERS YOU ALREADY USE
Long webtoon strips, page-by-page readers and image galleries. Click the toolbar button, right-click → "Translate this page", or press Alt+Shift+T. Turn on "Always translate on this site" for your favourites.

★ LETTERED TO FIT
The original lettering is removed and the translation follows the shape of the bubble. Click the mark on any page, or the ⇄ button, to compare with the original.

★ MANY LANGUAGES
From Japanese, Korean, Chinese, English, Spanish or Portuguese into English, Spanish, Portuguese, French, German, Italian, Indonesian, Vietnamese, Russian, Korean, Japanese and Chinese.

★ GUIDED SETUP
After installing, a setup page walks you through installing Ollama and downloading a model sized for your computer (1.9 to 6.2 GB, one time), with progress shown as it downloads.

FREE AND PRO
• Free: 30 new pages every day, with every feature. Pages you've already translated show again for free.
• Pro: unlimited pages for a one-time payment of $6.99. The translation still runs on your PC.

REQUIREMENTS
Windows 10/11, macOS or Linux, with 4 to 8 GB of free disk space. A graphics card with 6 GB or more of memory translates a page in seconds; without one it works, but slowly.

Source code: https://github.com/zzythe/local-manga-translator
Support: https://github.com/zzythe/local-manga-translator/issues

## Single purpose (Chrome privacy tab)
Translates the text in comic images on web pages the user chooses, using an AI model running locally on the user's computer.

## Permission justifications (Chrome privacy tab)

| Permission | Justification |
|---|---|
| Host permission `<all_urls>` | Comic readers load page images from many different image servers. The extension downloads the image the user asked it to translate (with the page as referrer, which many sites require) and replaces it on the page with the translated version. A small content script checks whether the user turned the translator on for the current site; it does nothing otherwise. |
| `scripting` | Loads the translator into the current tab when the user clicks the toolbar button, uses the context menu or presses the shortcut. |
| `storage` | Saves the user's language and model settings, sites set to "always translate", the free plan's daily page count, and Pro status. |
| `contextMenus` | Adds "Translate this page" to the right-click menu. |
| `declarativeNetRequestWithHostAccess` | Sets the referrer on the extension's own image downloads (many comic sites refuse images without it) and lets the extension's background requests reach the user's local Ollama server, which otherwise rejects browser extensions. The rules apply only to requests made by the extension itself, never to web pages. |
| Remote code | No. All code is in the package. |

## Data usage (Chrome privacy tab)
- Data collected: **none** by the developer. Check only "Financial and payment information" if the form asks about data handled by a payment processor: payments are processed by ExtensionPay/Stripe when the user buys Pro.
- Certify: not sold to third parties; not used for unrelated purposes; not used for creditworthiness.
- Privacy policy URL: https://zzythe.github.io/local-manga-translator/privacy.html

## Images to upload (in store/images/)
- Icon 128×128: `extension/icons/icon128.png`
- Screenshots 1280×800: `store/images/screenshot-*.png`
- Small promo tile 440×280: `store/images/promo-small.png`
- Marquee 1400×560 (optional): `store/images/promo-marquee.png`

## Firefox notes
- Upload `dist/local-manga-translator-<version>-firefox.zip`. Mozilla requires the source for review when code is generated: upload the repository zip (without node_modules) and say "run `npm ci && node build.mjs`; output is dist/firefox".
- Firefox makes website access opt-in; the setup page has an "Allow access" step for this.
