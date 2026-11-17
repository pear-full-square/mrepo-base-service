// run(text, env): a shell hook run with sh, the runtime's environment and
// what the hook needs added; -> { code, err }: its exit code, the last of
// what it said on stderr.
import { spawn } from 'bare-subprocess'
import process from 'bare-process'

export function run (text, env) {
  return new Promise(resolve => {
    const all = { ...process.env, ...env }
    // haicc's own scripts first, where its folder is known
    if (all.HAICC_HOME) all.PATH = `${all.HAICC_HOME}/bin:${all.PATH ?? ''}`
    const child = spawn('sh', ['-c', text, 'haicc-hook'], { env: all, stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''
    child.stderr.on('data', d => { err = (err + d.toString()).slice(-400) })
    child.on('exit', code => resolve({ code: code ?? 1, err: err.trim().split('\n').pop() ?? '' }))
  })
}
