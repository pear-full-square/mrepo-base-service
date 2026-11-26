// The service actions on a context written here: each moves the state; the
// config says where and when each is allowed.
import test from 'brittle'
import { initialise, start, stop, shutdown, STATE, stateOf } from '../index.js'

function context (state, hooks = {}) {
  const files = { [STATE]: Buffer.from(JSON.stringify({ state })) }
  for (const [t, text] of Object.entries(hooks)) files[`/runtime/hooks/${t}.haicc`] = Buffer.from(text)
  const ran = []
  const jobs = []
  return {
    ran,
    jobs,
    // (own: the runtime's, a line placed as the mrepo's own, the request returned back)
    runtime: { dir: '/x', uri: 'local/x', own: async line => ({ command: line, returned: { status: 'done', message: 'Done.', attachments: [] } }) },
    resumed: null,
    // a job waited for: kept, the request's answer none (it waits)
    wait: job => { jobs.push(job); return null },
    read: async uri => { if (!files[uri]) throw new Error('none'); return files[uri] },
    // the rest of an execution context, standing in: a file that may not
    // be there, the log (kept: entries), a step run as it is
    find: async function (p) { try { return await this.read(p) } catch { return null } },
    log: function (level, event, line) { if (typeof line !== 'string') throw new Error('not a log entry: a line'); (this.entries ??= []).push({ level, event, line }) },
    step: async function (event, line, fn, level = 'verbose') { const r = await fn(); (this.entries ??= []).push({ level, event, line: typeof line === 'function' ? line(r) : line }); return r },
    put: (uri, bytes) => { files[uri] = Buffer.from(bytes) },
    select: async pattern => Object.keys(files).filter(p => p.startsWith(pattern.slice(0, -1))).map(p => [p, {}]),
    run: async (command, opts) => { if (command[0] === 'fail/now') throw new Error('refused'); ran.push([command.join(' '), opts]) }
  }
}

test('the actions: the state moved, booted to started and back', async (t) => {
  const exec = context('booted')
  t.is(await initialise(exec), 'The service is initialised: its state is initialised.', 'what it says: what was done, and the state now')
  t.is(await start(exec), 'The service is started: its state is started.')
  t.is((await stateOf(exec)).state, 'started', 'written')
  t.is(await stop(exec), 'The service is stopped: its state is initialised.', 'stopped: back to initialised')
  t.is(await shutdown(exec), 'The service is shut down: its state is booted.', 'shut down: back to booted')
  t.alike(exec.ran, [], 'no hooks dropped in: none run')
})

test('the hooks: a transition with a hook file waits for its lines, then, resumed, moves the state; a line that failed fails it', async (t) => {
  const exec = context('booted', { initialise: '# made ready\ninfo/extract\n', start: 'protocol/activate . boot\n' })
  t.is(await initialise(exec), null, 'initialise: its hook file there: the request waits for its lines')
  t.alike([exec.jobs.length, (await stateOf(exec)).state], [1, 'booted'], 'one job, its lines through the mrepo\'s own inbox; the state not moved yet')
  t.is(await exec.jobs[0](), 'Ran its initialise hook, 1 line:\ninfo/extract', 'what the job says when it ends: the lines it ran')
  const resumed = { ...exec, resumed: { status: 'done', message: 'Ran its initialise hook, 1 line:\ninfo/extract', attachments: [] } }
  t.is(await initialise(resumed), 'The service is initialised: its state is initialised.', 'resumed with what the job returned: the state moved, said as ever')
  t.ok(resumed.entries.some(e => e.level === 'info' && e.event === 'hooks' && e.line === 'Ran its initialise hook, 1 line:\ninfo/extract'), 'what its hook ran: in its log')
  t.is(await start(exec), null, 'start: waits for its hook too')
  await t.exception(start({ ...exec, resumed: { status: 'failed', message: 'line 1: protocol/activate . boot: refused', attachments: [] } }), /hook start: line 1: protocol\/activate \. boot: refused/, 'resumed with a failure: the transition fails, the line said')
  t.is((await stateOf(exec)).state, 'initialised', 'the state not moved')
  t.is(await stop(exec), 'The service was initialised already: nothing moved.', 'no hook file for stop: no wait; on an initialised service, a repeat: allowed, the state as it is')
})

test('idempotent: a transition repeated in the state it leads to (or past it) runs its hook again, warns, the state as it is', async (t) => {
  const exec = context('started', { initialise: 'info/extract\n' })
  t.is(await initialise(exec), null, 'initialise on a started service: its hook run again, waited for')
  const resumed = { ...exec, resumed: { status: 'done', message: 'Ran its initialise hook, 1 line:\ninfo/extract', attachments: [] } }
  t.is(await initialise(resumed), 'The service was started already: nothing moved, its initialise hook run again.', 'resumed: a repeat, said; the state as it is, started')
  t.ok(resumed.entries.some(e => e.level === 'warn' && e.event === 'again' && e.line === 'A repeat: the service was started, not booted; nothing moved.'), 'a warning in its log')
  t.is(await start(exec), 'The service was started already: nothing moved.', 'start on a started service: a repeat')
  const booted = context('booted')
  t.is(await shutdown(booted), 'The service was booted already: nothing moved.', 'shutdown on a booted service: a repeat')
  t.is((await stateOf(exec)).state, 'started', 'nothing moved')
})

