// The service state, in the runtime layer (/runtime/service.json: { state }),
// read and moved by the service actions, each firing its transition's
// hooks first; and the protocol's config: each action at the mrepo itself
// (`.`), in the states
// that allow it (the state machine: booted -> initialised -> started, and
// back).
import * as json from 'mycelium-value-json'
import { hooks, scripts } from 'mrepo-base-request'
import { run } from './sh.js'

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
// Shell hooks (<name>.sh): run by the runtime with sh, outside this
// execution, one after the other; the request waits for them (exec.wait),
// the runtime free meanwhile to execute what they send in; then resumed,
// the state moved. A hook that stops with another exit code fails the
// transition. Their haicc reaches this mrepo straight (HAICC_MREPO).
export async function transition (exec, name, state, done, form = {}) {
  const shell = await scripts(exec, name)
  if (shell.length && !form.resumed) {
    const env = { HAICC_MREPO: exec.runtime.dir, HAICC_MREPO_URI: exec.runtime.uri }
    exec.log('debug', 'shell hooks', { transition: name, hooks: shell.map(h => h.name) })
    return exec.wait(async () => {
      const ran = []
      for (const h of shell) {
        const r = await run(h.text, env)
        if (r.code !== 0) throw new Error(`hook ${name}/${h.name}: exit ${r.code}${r.err ? `: ${r.err}` : ''}`)
        ran.push(h.name)
      }
      return ran
    })
  }
  if (form.resumed?.error) throw new Error(form.resumed.error)
  if (form.resumed) exec.log('info', 'hooks', { transition: name, ran: form.resumed.output })
  const found = await hooks(exec, name)
  exec.log('debug', 'hooks', { transition: name, hooks: found.map(h => h.name) })
  for (const h of found) {
    await exec.step('hook', { transition: name, hook: h.name, command: h.command.join(' ') }, () => exec.run(h.command, { own: true }), 'info')
  }
  return moveTo(exec, state, done)
}

