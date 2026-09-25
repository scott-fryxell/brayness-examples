// A ```mermaid fence builds to <pre class="mermaid">. Load mermaid only on
// pages that have one, themed from the stylesheet's own colors.
const diagrams = document.querySelectorAll('pre.mermaid')

if (diagrams.length) {
  await new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '/scripts/mermaid.min.js'
    script.onload = resolve
    script.onerror = reject
    document.head.append(script)
  })
  // mermaid has no theme that follows the OS, so read the page's colors
  const css = getComputedStyle(document.documentElement)
  const color = name => css.getPropertyValue(name).trim()
  const surface = color('--surface')
  const text = color('--text')
  const line = color('--blue')
  window.mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
      fontFamily: getComputedStyle(document.body).fontFamily,
      background: surface,
      primaryColor: surface,
      primaryTextColor: text,
      primaryBorderColor: line,
      lineColor: line,
      textColor: text,
      nodeBorder: line,
      clusterBkg: surface,
      clusterBorder: line
    },
    flowchart: { curve: 'basis', padding: 12 }
  })
  await window.mermaid.run({ nodes: diagrams })
}
