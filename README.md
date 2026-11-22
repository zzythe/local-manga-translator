# Local Manga Translator

Translate manga, manhwa and manhua **right on the page**, with AI that runs on your own computer. Nothing you read is uploaded, there's no account, and it keeps working on sites and pages that online translators refuse.

**Get it:** Chrome Web Store · Microsoft Edge Add-ons · Firefox Add-ons *(links once the listings are live)* · [Website](https://zzythe.github.io/local-manga-translator/)

## How it works

1. Open a comic in any web reader and click the translator's toolbar button (or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd>).
2. The extension downloads the page image the same way your browser does and finds the lettering in speech bubbles, captions and sound effects.
3. A vision model running in [Ollama](https://ollama.com) on your PC reads the text. The lines are translated with the previous pages as context.
4. The original text is cleaned from the bubbles and the translation is lettered to fit, then the page image is swapped in place. Pages ahead of you are translated while you read.

The setup page that opens after installing walks you through installing Ollama and downloading a model (1.9 to 6.2 GB, one time).

## Free and Pro

The free plan translates 30 new pages a day. Pro removes the limit with a one-time payment, handled by [ExtensionPay](https://extensionpay.com).

## Privacy

Everything runs locally. The extension connects only to the comic site you're reading (to load its images), to Ollama on your own computer, and to ExtensionPay if you buy Pro. It collects no analytics. See the [privacy policy](https://zzythe.github.io/local-manga-translator/privacy.html).

## Building it yourself

This repository is source-available so you can check exactly what the extension does. You may build and use it for personal, non-commercial use; you may not publish or share builds (see [LICENSE.md](LICENSE.md)).

```sh
npm install
npm run build      # dist/chrome, dist/firefox and store zips
npm test           # unit tests for the image and text pipeline
node tools/e2e.mjs # end-to-end test in Microsoft Edge (needs Ollama with a qwen3-vl model)
```

Load `dist/chrome` with "Load unpacked" on `chrome://extensions` (Developer mode on).

| Path | What it is |
|---|---|
| `src/translator.src.js` | The translator: text detection, cleaning, lettering, Ollama prompts and the on-page control |
| `extension/` | Extension shell: background worker, setup page, sample page, icons |
| `build.mjs` | Builds the extension for Chromium browsers and Firefox |
| `tools/` | Icon rendering, end-to-end tests and quality checks |
| `docs/` | The website (GitHub Pages) |
| `store/` | Store listing text and images |
