// shutdown: service shutdown /, the service state moved to booted (README.md beside it).
import { transition } from '../../internal/state.js'

// log: in transition (../../internal/state.js): its hooks, the state moved
export const shutdown = exec => transition(exec, 'shutdown', 'booted', 'shut down')
