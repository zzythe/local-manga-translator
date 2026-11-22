# Store listing: Local Manga Translator

Use the same text on the Chrome Web Store, Microsoft Edge Add-ons and Firefox Add-ons.

## Name
Local Manga Translator

## Short description (Chrome: 132 characters max)
Translates manga, manhwa and manhua in place, using a vision model running on your own computer.

## Category
Chrome: **Tools**. Edge: **Productivity**. Firefox: **Language Support**.

## Description

Local Manga Translator translates manga, manhwa and manhua in place. The text is read and translated by a vision model running in Ollama on your own computer, so pages never leave it.

Open a chapter and click the toolbar button, right-click the page, or press Alt+Shift+T. Pages are translated as you scroll, a few ahead of where you are. The original text is removed from each bubble and the translation is set to fit. Click the mark on a page to compare it with the original, or save the translated page as an image. Translated pages are kept in memory only and never saved unless you save one.

It works on long strips, page-by-page readers and galleries, and translates captions and sound effects as well as speech bubbles. Source languages: Japanese, Korean, Chinese, English, Spanish, Portuguese. Target languages: English and 14 others.

On first install a setup page walks you through installing Ollama and downloading a model (1.9 to 6.2 GB).

60 new pages an hour are free. A page counts when it first appears on your screen, not when it's translated ahead, and images from long strips count as half a page. Pro removes the limit for a one-time $4.99.

Requirements: Windows 10 or later, macOS or Linux. A GPU with 6 GB of VRAM or more is recommended; on the CPU a page can take a minute.

Source code and bug reports: https://github.com/zzythe/local-manga-translator

The comic pages in the screenshots are from Pepper&Carrot by David Revoy, CC BY 4.0.

## Single purpose (Chrome privacy tab)
Translates the text in comic images on web pages the user chooses, using an AI model running locally on the user's computer.

## Permission justifications (Chrome privacy tab)

| Permission | Justification |
|---|---|
| Host permission `<all_urls>` | Comic readers load page images from many different image servers. The extension downloads the image the user asked it to translate (with the page as referrer, which many sites require) and replaces it on the page with the translated version. On readers with one page per address, it also downloads the next page of the same site to translate its image ahead. A small content script checks whether the user turned the translator on for the current site; it does nothing otherwise. |
| `scripting` | Loads the translator into the current tab when the user clicks the toolbar button, uses the context menu or presses the shortcut. |
| `storage` | Saves the user's language and model settings, sites set to translate automatically, names the user entered for each site, the free plan's hourly page count, and Pro status. Session storage (memory only) holds the sites the translator is turned on for until the browser closes. |
| `alarms` | Clears the free plan's list of pages counted the day before, also on days nothing is translated. |
| `contextMenus` | Adds "Translate this page" to the right-click menu. |
| `declarativeNetRequestWithHostAccess` | Sets the referrer on the extension's own image downloads (many comic sites refuse images without it) and lets the extension's background requests reach the user's local Ollama server, which otherwise rejects browser extensions. The rules apply only to requests made by the extension itself, never to web pages. |
| `offscreen` | Runs two small local models (one finds speech bubbles, one repaints artwork under sound effects) in an offscreen page shared by all tabs. The background service worker can't start the threads they use. The same page keeps each tab's translated pages in memory, so going back or reloading shows them at once. |
| Remote code | No. All code is in the package. The two models' weights (72 MB, no code) are downloaded once from Hugging Face. |

## Data usage (Chrome privacy tab)
- Data collected: **none** by the developer. Check only "Financial and payment information" if the form asks about data handled by a payment processor: payments are processed by ExtensionPay/Stripe when the user buys Pro.
- Certify: not sold to third parties; not used for unrelated purposes; not used for creditworthiness.
- Privacy policy URL: https://zzythe.github.io/local-manga-translator/privacy.html

## Images to upload (in store/images/)
- Icon 128×128: `extension/icons/icon128.png`
- Screenshots 1280×800, in this order: `screenshot-1.png` (original and translated), `screenshot-2.png` (reader), `screenshot-3.png` (settings), `screenshot-4.png` (setup page)
- Small promo tile 440×280: `promo-small.png`
- Marquee 1400×560 (optional): `promo-marquee.png`

To make them again: `node build.mjs`, then with Ollama running `node tools/capture-translations.mjs` and `node tools/store-shots.mjs`, then `node tools/store-images.mjs` (no model needed; also writes `docs/img/before.jpg` and `after.jpg`).

## Firefox notes
- Upload `dist/local-manga-translator-<version>-firefox.zip`. Mozilla requires the source for review when code is generated: upload the repository zip (without node_modules) and say "run `npm ci && node build.mjs`; output is dist/firefox".
- Firefox makes website access opt-in; the setup page has an "Allow access" step for this.
