import css from './theme.css?raw'

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(?:^|[}/])\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css)
  if (!match) throw new Error(`no rule for ${selector}`)
  return match[1]
}

test(':root declares the dark palette, so dark is the no-signal default', () => {
  const root = rule(':root')
  expect(root).toMatch(/--bg:\s*#0f1115/)
  expect(root).toMatch(/--fg:\s*#e9ebf0/)
  expect(root).not.toMatch(/--bg:\s*#ffffff/i)
})

test('light values only apply under a light preference or an explicit light theme', () => {
  expect(css).toMatch(/@media \(prefers-color-scheme: light\)\s*\{\s*:root:not\(\[data-theme='dark'\]\)/)
  expect(rule(`:root[data-theme='light']`)).toMatch(/--bg:\s*#ffffff/)
  expect(rule(`:root[data-theme='dark']`)).toMatch(/--bg:\s*#0f1115/)
})




