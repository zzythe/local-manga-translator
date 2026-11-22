# Development

```sh
npm install
npm run build      # dist/chrome, dist/firefox and store zips
npm test           # unit tests for the image and text pipeline
node tools/e2e.mjs # end-to-end test in Microsoft Edge (needs Ollama with a qwen3-vl model)
```

Load `dist/chrome` with "Load unpacked" on `chrome://extensions` (Developer mode on).
