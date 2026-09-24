// Rebuild on every change and serve dist. Pages poll /build-stamp.txt and
// reload themselves.
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const OUT = 'dist'
const PORT = Number(process.env.PORT) || 3000
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain'
}

const watcher = spawn(process.execPath, ['build.js', '--drafts', '--watch'], { stdio: 'inherit' })
process.on('exit', () => watcher.kill())
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit())

async function resolve(url) {
  const path = join(OUT, normalize(decodeURIComponent(url.split('?')[0])))
  const info = await stat(path).catch(() => null)
  if (info?.isDirectory()) return join(path, 'index.html')
  return path
}

createServer(async (request, response) => {
  const path = await resolve(request.url)
  const body = await readFile(path).catch(() => null)
  if (!body) {
    response.writeHead(404).end('not found')
    return
  }
  response.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' })
  response.end(body)
}).listen(PORT, () => console.log(`http://localhost:${PORT}`))
