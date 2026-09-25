# brayness-examples

One folder per example. Each is a complete npm package that runs on its own.
Take one with:

```sh
npx giget gh:scott-fryxell/brayness-examples/<name> <name>
cd <name> && npm install && npm run dev
```

| Example | What it is |
|---------|------------|
| `terminal` | A terminal in the browser: libghostty-vt as WASM, drawn on a canvas |
| `static` | Markdown articles as semantic HTML: partials, microdata, previews, sitemap |
| `app` | A Vue notes app; each note is a microdata article saved by `@realness.online/store` |
