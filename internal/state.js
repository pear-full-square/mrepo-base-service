// The service state, in the runtime layer (/runtime/service.json: { state }),
// read and moved by the service actions, each firing its transition's
// hooks first; and the protocol's config: each action at the mrepo itself
// (`.`), in the states
// that allow it (the state machine: booted -> initialised -> started, and
// back).
import * as json from 'mycelium-value-json'
import { hooks } from 'mrepo-base-request'

export const STATE = '/runtime/service.json'

// log: none (one read; moveTo and transition say what was done)
export async function stateOf (exec) {
  return JSON.parse((await exec.read(STATE)).toString())
}

// The state moved: the answer says what was done (done: initialised,
// started, stopped, shut down) and the state the service is in now.
export async function moveTo (exec, state, done) {
  const was = await stateOf(exec)
  exec.put(STATE, json.encode({ ...was, state }))
  exec.log('verbose', 'moved', { from: was.state, to: state })
  return { service: done, state }
}

// A transition made: its hooks run first (the commands the mrepo's defining
// package dropped into /runtime/hooks/<transition>/, in name order), each in
// this same execution, as the mrepo's own; then the state moved. A hook that
// fails fails the transition: nothing of it stays.
export async function transition (exec, name, state, done) {
  const found = await hooks(exec, name)
  exec.log('debug', 'hooks', { transition: name, hooks: found.map(h => h.name) })
  for (const h of found) {
    await exec.step('hook', { transition: name, hook: h.name, command: h.command.join(' ') }, () => exec.run(h.command, { own: true }), 'info')
  }
  return moveTo(exec, state, done)
}

