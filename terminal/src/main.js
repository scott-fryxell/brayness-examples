import { load_engine, apply_theme, KEY, paste_encode } from "./ghostty-vt.js"
import { draw_frame, cell_metrics } from "./render-canvas.js"
import { subliminal } from "./themes/subliminal.js"

// Wasm lives in public/, so it resolves under whatever base the page is served
// from.
const WASM_URL = new URL("ghostty-vt.wasm", document.baseURI)

const status = document.querySelector("output")
const canvas = document.querySelector("canvas")
const stage = document.querySelector("main")
const ctx = canvas.getContext("2d")

const FONT_SIZE = 14
const metrics = cell_metrics(ctx, FONT_SIZE)

function size_terminal() {
  const cols = Math.max(20, Math.floor((stage.clientWidth - 16) / metrics.width))
  const rows = Math.max(6, Math.floor((stage.clientHeight - 8) / metrics.height))
  return { cols, rows }
}

const engine = await load_engine(WASM_URL)

canvas.addEventListener("click", () => canvas.focus())
canvas.focus()

let { cols, rows } = size_terminal()
const term = engine.terminal(cols, rows)
apply_theme(term, subliminal)
document.body.style.background = `rgb(${subliminal.background.join(",")})`
let encoder = engine.key_encoder(term)

let bracketed = false
let connected = false
let closed = false
let raf = 0
let blink_on = true
let blink_timer = 0
let sel = null
let note = ""
let note_timer = 0
function redraw() {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    apply_selection()
    const frame = term.frame()
    draw_frame(ctx, frame, { font_size: FONT_SIZE, blink_on, selection_color: subliminal.selection_background })
    const base = closed ? (exited ? "disconnected" : "reconnecting...") : connected ? "" : "connecting..."
    status.textContent = note || base
    schedule_blink(frame)
  })
}

function set_note(text) {
  note = text
  clearTimeout(note_timer)
  note_timer = setTimeout(() => {
    note = ""
    redraw()
  }, 1600)
}

// Selection lives in viewport cells; re-applied each frame so pi's writes do
// not drop it.
function apply_selection() {
  if (!sel) return
  try {
    term.select_range(sel.ax, sel.ay, sel.bx, sel.by)
  } catch {
    sel = null
  }
}

// Blink only when the terminal asks for it; pi draws its own cursor cell.
function schedule_blink(frame) {
  clearTimeout(blink_timer)
  if (!frame.cursor.visible || !frame.cursor.blinking) return
  blink_timer = setTimeout(() => {
    blink_on = !blink_on
    redraw()
  }, 530)
}

// The wire is the orchestrator's pty protocol: JSON text frames, bytes as
// base64. {op: "data", data_b64} both ways, {op: "resize", cols, rows} up,
// {op: "exit", code} down.
const session = new URLSearchParams(location.search).get("session")
const scheme = location.protocol === "https:" ? "wss" : "ws"
const query = new URLSearchParams({ cols, rows })
if (session) query.set("session", session)
const pty_url = `${scheme}://${location.host}${new URL("pty", document.baseURI).pathname}`
// A dropped socket (host restart, idled VM) reconnects; attaching wakes the
// session. The holder ignores `exec` when Pi is running, so this is safe either way.
const RETRY_MS = [500, 1000, 2000, 4000, 8000]
let ws = null
let retries = 0
let exited = false

function to_base64(bytes) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function from_base64(text) {
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0))
}

function send_resize() {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ op: "resize", cols, rows }))
}

function connect() {
  query.set("cols", cols)
  query.set("rows", rows)
  ws = new WebSocket(`${pty_url}?${query}`)
  ws.onopen = on_open
  ws.onmessage = on_message
  ws.onclose = on_close
}

function on_open() {
  if (retries) {
    // A cold boot starts from a bare shell; clear the old screen first.
    term.write(new TextEncoder().encode("\x1bc"))
    redraw()
  }
  connected = true
  closed = false
  retries = 0
  send_resize()
  // ?exec=<command> replaces the shell with it, so its exit lands in the shell.
  // Old links may include --continue; refresh always starts a new conversation.
  const command = new URLSearchParams(location.search).get("exec")?.replace(/ --continue$/, "")
  if (command) {
    const url = new URL(location.href)
    url.searchParams.set("exec", command)
    history.replaceState(null, "", url)
    send(new TextEncoder().encode(`exec ${command}\r`))
  }
}

function on_message(event) {
  const message = JSON.parse(event.data)
  if (message.op === "exit") {
    exited = true
    set_note(`exit ${message.code}`)
    ws.close()
    return
  }
  if (message.op !== "data") return
  const bytes = from_base64(message.data_b64)
  const text = new TextDecoder().decode(bytes)
  if (text.includes("\x1b[?2004h")) bracketed = true
  if (text.includes("\x1b[?2004l")) bracketed = false
  term.write(bytes)
  // pi pushes Kitty keyboard after startup; keep the encoder in sync.
  if (text.includes("\x1b[")) encoder.set_from_terminal(term)
  redraw()
}

function on_close() {
  connected = false
  closed = true
  if (exited) {
    status.textContent = "disconnected"
    return
  }
  status.textContent = "reconnecting..."
  setTimeout(connect, RETRY_MS[Math.min(retries, RETRY_MS.length - 1)])
  retries += 1
}

connect()

const KEY_MAP = {
  Escape: KEY.ESCAPE,
  Enter: KEY.ENTER,
  Tab: KEY.TAB,
  Backspace: KEY.BACKSPACE,
  ArrowUp: KEY.ARROW_UP,
  ArrowDown: KEY.ARROW_DOWN,
  ArrowLeft: KEY.ARROW_LEFT,
  ArrowRight: KEY.ARROW_RIGHT,
  Home: KEY.HOME,
  End: KEY.END,
  PageUp: KEY.PAGE_UP,
  PageDown: KEY.PAGE_DOWN,
  Delete: KEY.DELETE,
}

const LETTER_KEY = {}
"abcdefghijklmnopqrstuvwxyz".split("").forEach((letter, index) => {
  LETTER_KEY[letter] = 20 + index // GhosttyKey A..Z
})

function send(bytes) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ op: "data", data_b64: to_base64(bytes) }))
}

function clear_scrollback() {
  term.clear_scrollback()
  term.scroll_to_bottom()
  sel = null
  set_note("scrollback cleared")
  redraw()
}

async function copy_selection() {
  const text = term.selection_text()
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    set_note(`copied ${text.length} chars`)
  } catch {
    // Fallback for documents without clipboard permission.
    const area = document.createElement("textarea")
    area.value = text
    area.setAttribute("readonly", "")
    area.style.position = "fixed"
    area.style.opacity = "0"
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand("copy")
    area.remove()
    set_note(ok ? `copied ${text.length} chars` : "copy failed")
  }
  redraw()
}

function cell_at(event) {
  const rect = canvas.getBoundingClientRect()
  const x = Math.min(cols - 1, Math.max(0, Math.floor((event.clientX - rect.left) / metrics.width)))
  const y = Math.min(rows - 1, Math.max(0, Math.floor((event.clientY - rect.top) / metrics.height)))
  return { x, y }
}

canvas.addEventListener("mousedown", (event) => {
  canvas.focus()
  const cell = cell_at(event)
  sel = { ax: cell.x, ay: cell.y, bx: cell.x, by: cell.y }
  redraw()
})

window.addEventListener("mousemove", (event) => {
  if (!sel || event.buttons === 0) return
  const cell = cell_at(event)
  if (cell.x === sel.bx && cell.y === sel.by) return
  sel.bx = cell.x
  sel.by = cell.y
  redraw()
})

window.addEventListener("mouseup", () => {
  if (sel && sel.ax === sel.bx && sel.ay === sel.by) sel = null
  redraw()
})

// Wheel scrolls the scrollback. A scroll moves the viewport, so any selection
// keyed to viewport cells is dropped.
canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault()
    sel = null
    term.scroll(event.deltaY > 0 ? 3 : -3)
    redraw()
  },
  { passive: false },
)

window.addEventListener("keydown", (event) => {
  if (event.metaKey && event.key.toLowerCase() === "k") {
    event.preventDefault()
    clear_scrollback()
    return
  }
  if (event.metaKey && event.key.toLowerCase() === "c" && sel) {
    event.preventDefault()
    copy_selection()
    return
  }
  if (event.metaKey) return
  const letter = event.key.toLowerCase()
  if (event.ctrlKey && LETTER_KEY[letter]) {
    event.preventDefault()
    send(encoder.encode({ key: LETTER_KEY[letter], mods: 2, utf8: letter, unshifted_codepoint: letter.codePointAt(0) }))
    return
  }
  if (KEY_MAP[event.key]) {
    event.preventDefault()
    let mods = 0
    if (event.shiftKey) mods |= 1
    if (event.ctrlKey) mods |= 2
    if (event.altKey) mods |= 4
    send(encoder.encode({ key: KEY_MAP[event.key], mods }))
    return
  }
  if (event.key.length === 1 && !event.ctrlKey && !event.altKey) {
    event.preventDefault()
    send(new TextEncoder().encode(event.key))
  }
})

window.addEventListener("paste", (event) => {
  const text = event.clipboardData.getData("text")
  if (!text) return
  event.preventDefault()
  send(paste_encode(engine, text, bracketed))
})

let resize_timer = 0
window.addEventListener("resize", () => {
  clearTimeout(resize_timer)
  resize_timer = setTimeout(() => {
    const next = size_terminal()
    if (next.cols === cols && next.rows === rows) return
    cols = next.cols
    rows = next.rows
    term.resize(cols, rows)
    send_resize()
    redraw()
  }, 150)
})

window.brayness = {
  frame: () => term.frame(),
  screen_text: () => term.screen_text(),
  selection_text: () => term.selection_text(),
  scrollbar: () => term.scrollbar(),
  clear_scrollback: clear_scrollback,
  scroll: (delta) => {
    term.scroll(delta)
    redraw()
  },
  copy: copy_selection,
  resize: (c, r) => {
    cols = c
    rows = r
    term.resize(c, r)
    send_resize()
    redraw()
  },
}

redraw()
