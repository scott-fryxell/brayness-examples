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

## Decisions

- One folder per example in `brayness-examples`; each runs alone.
- Sessions download with giget, and install only when asked.
- `@realness.online/itemid` and `/store` release by tag via OIDC.
- Pin `@comark/html` 0.4.0; 0.7 drops `render`.

## Future

Briefs for examples not built yet, in `future/`:

| Brief | What it is |
|-------|------------|
| [`vacation-sf.md`](future/vacation-sf.md) | A shop for a North Beach vintage store: items, cart, checkout |
