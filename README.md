<p align="center"><img src="docs/img/icon.png" width="128" alt=""></p>

# Local Manga Translator

Local Manga Translator is a browser extension that translates manga, manhwa and manhua in place. The text is read and translated by a vision model running in [Ollama](https://ollama.com) on your own machine.

## Usage

Open a chapter and click the toolbar button, right-click the page, or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd>. Pages are translated as you scroll, a few ahead of where you are. Click the mark on a page to switch between the original and the translation.

On first install a setup page walks you through installing Ollama and downloading a model.

## System requirements

- Chrome, Edge, Brave, Vivaldi, Opera, or Firefox 128 or later.
- Windows 10 or later, macOS, or Linux, with 2 to 7 GB of disk space for the model.
- A GPU with 6 GB of VRAM or more is recommended. It runs on the CPU too, but a page can take a minute.

## Pricing

60 new pages an hour are free. A page counts when it first appears on your screen, and images from long strips count as half a page. Pro removes the limit for a one-time $4.99.

## Privacy

The extension only talks to the site you're reading (to fetch page images), to Ollama on localhost, and to ExtensionPay if you buy Pro. See the [privacy policy](https://zzythe.github.io/local-manga-translator/privacy.html).

## Bug reports

Open an [issue](https://github.com/zzythe/local-manga-translator/issues). Include the site, your browser, and the model you use.

## License

Source available under the [PolyForm Strict License 1.0.0](LICENSE.md). Sample pages are from [Pepper&Carrot](https://www.peppercarrot.com) by David Revoy (CC BY 4.0). Other third-party licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
