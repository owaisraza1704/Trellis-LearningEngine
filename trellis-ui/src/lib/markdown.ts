import type { Root, RootContent } from 'mdast'

// Older saved answers put numeric citations on the closing fence itself.
export function repairCitationFences(markdown: string): string {
  let fence = ''
  return markdown
    .split('\n')
    .map((line) => {
      const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
      if (!marker) return line
      if (!fence) {
        fence = marker[1]
        return line
      }
      if (marker[1][0] !== fence[0] || marker[1].length < fence.length) return line
      if (!marker[2].trim()) {
        fence = ''
      } else if (/^\s+(?:\[\d+\]\s*)+$/.test(marker[2])) {
        fence = ''
        return `${marker[1]}\n\n${marker[2].trim()}`
      }
      return line
    })
    .join('\n')
}

export function remarkCitations({ count }: { count: number }) {
  return (tree: Root) => {
    function visit(parent: Root | RootContent) {
      if (!('children' in parent) || ['link', 'linkReference'].includes(parent.type)) return
      const children: RootContent[] = []
      for (const child of parent.children) {
        if (child.type !== 'text') {
          visit(child)
          children.push(child)
          continue
        }
        let start = 0
        for (const match of child.value.matchAll(/\[(\d+)\]/g)) {
          const number = Number(match[1])
          if (number < 1 || number > count) continue
          if (match.index > start)
            children.push({ type: 'text', value: child.value.slice(start, match.index) })
          children.push({
            type: 'link',
            url: `#trellis-citation-${number}`,
            children: [{ type: 'text', value: match[0] }],
          })
          start = match.index + match[0].length
        }
        children.push({ type: 'text', value: child.value.slice(start) })
      }
      // Each replacement has the same inline/block position as the original child.
      parent.children = children as typeof parent.children
    }
    visit(tree)
  }
}
