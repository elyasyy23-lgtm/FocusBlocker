import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const SERVICE_PATH = new URL(
  '../modules/focus-guard/android/src/main/java/com/focusblocker/guard/FocusAccessibilityService.kt',
  import.meta.url,
)
const source = readFileSync(SERVICE_PATH, 'utf8')

function functionBody(src, signature, label) {
  const match = src.match(signature)
  assert.ok(match, `${label} signature is missing`)
  const open = src.indexOf('{', match.index + match[0].length)
  assert.notEqual(open, -1, `${label} body is missing`)
  let depth = 0
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i]
    if (ch === '{') depth += 1
    if (ch === '}') {
      depth -= 1
      if (depth === 0) return src.slice(open + 1, i)
    }
  }
  assert.fail(`${label} body is unbalanced`)
}

test('Xiaomi Background autostart ejection is protection-gated and presses Back', () => {
  const body = functionBody(
    source,
    /private fun guardBackgroundAutostart\(\s*event:\s*AccessibilityEvent\s*\):\s*Boolean/,
    'guardBackgroundAutostart()',
  )

  assert.match(
    body,
    /if\s*\(!FocusGuardStore\.isEnabled\(this\)\)\s*return false/,
    'guard must be inactive when Protection is OFF',
  )
  assert.match(
    body,
    /com\.miui\.securitycenter/,
    'guard must recognize the Xiaomi security-center settings package',
  )
  assert.match(body, /AutoStart/i, 'guard must recognize the Xiaomi autostart page')
  assert.match(
    body,
    /performGlobalAction\(GLOBAL_ACTION_BACK\)|pressBack\(\)/,
    'guard must eject the settings page with Back',
  )

  const dispatch = functionBody(
    source,
    /override fun onAccessibilityEvent\(event:\s*AccessibilityEvent\)/,
    'onAccessibilityEvent()',
  )
  const hookIndex = dispatch.search(/guardBackgroundAutostart\(event\)/)
  const generalGateIndex = dispatch.search(/if\s*\(!enabled/)
  assert.notEqual(hookIndex, -1, 'onAccessibilityEvent() must call guardBackgroundAutostart(event)')
  assert.notEqual(generalGateIndex, -1, 'onAccessibilityEvent() general gate was not found')
  assert.ok(
    hookIndex < generalGateIndex,
    'guard must run before the general keyword/domain gate so it works without block rules',
  )
})
