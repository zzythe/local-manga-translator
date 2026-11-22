# Store listing: Local Manga Translator

Use the same text on the Chrome Web Store, Microsoft Edge Add-ons and Firefox Add-ons.

## Name
Local Manga Translator

## Short description (Chrome: 132 characters max; comes from the manifest)
Translates manga, manhwa and manhua on the page, using an AI model that runs on your own computer.

## Category
Chrome: **Tools**. Edge: **Productivity**. Firefox: **Language Support**.

## Description

Chrome shows the short description right above this, so this doesn't repeat it.

```
Everything runs in Ollama on your computer, so the pages you read are never uploaded.

Open a chapter and click the toolbar button, right-click the page, or press Alt+Shift+T. The original text is erased and the translation is lettered into each bubble. Captions and sound effects are translated too. The next pages are translated while you read.

Works with long strips, page-by-page readers, and readers where each page has its own address.

Translates from Japanese, Korean, Chinese, English, Spanish and Portuguese into English and 14 other languages.

Setup
The first time, a setup page walks you through installing Ollama (free) and downloading a model (about 3 GB). Works on Windows, macOS and Linux. A graphics card with 6 GB of memory or more is recommended. On a Radeon RX 7800 XT a page takes about 5 seconds. Without a graphics card, a page can take a minute.

Price
60 pages an hour are free. Pro removes the limit for a one-time $4.99.

Privacy
No ads and no tracking. Translated pages stay in memory and are cleared when you close the tab. An account is only needed to buy Pro.

Website: https://zzythe.github.io/local-manga-translator/
Bug reports: https://github.com/zzythe/local-manga-translator/issues

The sample pages in the screenshots are from Pepper&Carrot by David Revoy (CC BY 4.0).
```

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
