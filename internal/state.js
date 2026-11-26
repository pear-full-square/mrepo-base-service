// The service state, in the runtime layer (/runtime/service.json: { state }),
// read and moved by the service actions, each firing its transition's
// hooks first; and the protocol's config: each action at the mrepo itself
// (`.`), in the states
// that allow it (the state machine: booted -> initialised -> started, and
// back).
import * as json from 'mycelium-value-json'
import { hookOf, parse, runLines } from 'mrepo-base-request'

export const STATE = '/runtime/service.json'

// log: none (one read; moveTo and transition say what was done)
export async function stateOf (exec) {
  return JSON.parse((await exec.read(STATE)).toString())
}

// The state moved: what is said: what was done (done: initialised,
// started, stopped, shut down) and the state the service is in now (the
// state itself: /runtime/service.json).
export async function moveTo (exec, state, done) {
  const was = await stateOf(exec)
  exec.put(STATE, json.encode({ ...was, state }))
  exec.log('verbose', 'moved', `Its state moved from ${was.state} to ${state}.`)
  return `The service is ${done}: its state is ${state}.`
}

// A transition made: its hook file (/runtime/hooks/<transition>.haicc, the
// mrepo's defining package's), lines of simple commands, run through the
// mrepo's own inbox, each its own request; the request waits for them
// (exec.wait), the runtime free meanwhile to execute them; then resumed
// with what that job returned (exec.resumed), the state moved. A line
// that fails fails the transition: the state stays.
// Idempotent: from `from` it moves to `state`; in any other state its
// config allows (the state it leads to, or past it: initialise on a
// started mrepo), it is a repeat: its hook run again (the hook's work is
// what makes a repeat safe: an initialise again adds what is new), a
// warning, the state as it is.
export async function transition (exec, name, state, done, form = {}, from = null) {
  const resumed = exec.resumed ?? null
  if (resumed?.status === 'failed') throw new Error(`hook ${name}: ${resumed.message}`)
  if (!resumed) {
    const text = await hookOf(exec, name)
    if (text !== null) {
      const lines = parse(text)
      exec.log('debug', 'hooks', `Its ${name} hook: ${lines.length} ${lines.length === 1 ? 'line' : 'lines'}, each a request of its own.`)
      return exec.wait(async () => {
        const ran = await runLines({ dir: exec.runtime.dir, uri: exec.runtime.uri, submit: exec.runtime.submit, answer: exec.runtime.answer, own: exec.runtime.own }, lines, '.')
        return [`Ran its ${name} hook, ${ran.length} ${ran.length === 1 ? 'line' : 'lines'}:`, ...ran.map(r => r.line)].join('\n')
      })
    }
  } else exec.log('info', 'hooks', resumed.message)
  const was = (await stateOf(exec)).state
  if (from !== null && was !== from) {
    exec.log('warn', 'again', `A repeat: the service was ${was}, not ${from}; nothing moved.`)
    return `The service was ${was} already: nothing moved${resumed ? `, its ${name} hook run again` : ''}.`
  }
  return moveTo(exec, state, done)
}
