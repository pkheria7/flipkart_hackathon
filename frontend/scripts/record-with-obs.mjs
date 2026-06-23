/**
 * GridLock Demo Recording — OBS WebSocket Controller
 *
 * Prerequisites:
 *   1. OBS is open with the obs-websocket plugin enabled (port 4455, password in OBS_WS_PASSWORD)
 *   2. A scene named "GridLock Demo" exists in OBS with a browser/window capture source
 *   3. The Vite dev server is running: cd frontend && npm run dev
 *   4. OBS output folder is configured
 *
 * Usage:
 *   node scripts/record-with-obs.mjs
 *
 * Or via npm:
 *   npm run record:walkthrough   (starts recording, runs Playwright, stops recording)
 */

import { spawn } from 'node:child_process'
import OBSWebSocket from 'obs-websocket-js'

const OBS_URL = process.env.OBS_WS_URL ?? 'ws://127.0.0.1:4455'
const OBS_PASSWORD = process.env.OBS_WS_PASSWORD ?? ''
const OBS_SCENE = process.env.OBS_SCENE ?? 'GridLock Demo'

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function runPlaywright() {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'npx',
      ['playwright', 'test', 'tests/demo/frontend-walkthrough.spec.ts', '--project=chromium'],
      { stdio: 'inherit', shell: true }
    )
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Playwright exited with code ${code}`))
    })
  })
}

async function main() {
  const obs = new OBSWebSocket()

  console.log('Connecting to OBS WebSocket…')
  await obs.connect(OBS_URL, OBS_PASSWORD)
  console.log('Connected.')

  // Switch to the demo scene
  await obs.call('SetCurrentProgramScene', { sceneName: OBS_SCENE })
  await sleep(1000)

  // Start recording
  console.log('Starting OBS recording…')
  await obs.call('StartRecord')
  await sleep(2000) // give OBS time to begin

  try {
    console.log('Running Playwright walkthrough…')
    await runPlaywright()
    console.log('Playwright finished.')
  } catch (err) {
    console.error('Playwright error:', err.message)
  } finally {
    // Stop recording regardless of playwright outcome
    await sleep(1500)
    console.log('Stopping OBS recording…')
    await obs.call('StopRecord')
    await sleep(1000)
    await obs.disconnect()
    console.log('Done. Check your OBS output folder for the recording.')
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
