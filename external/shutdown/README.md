# shutdown

Moves the service from initialised back to booted.

## Signature

`shutdown(exec)`: requested as `service/shutdown`.

## Returns

What it did, said: `The service is <done>: its state is <state>.`; a
repeat: `The service was <state> already: nothing moved`, its hook run
again where it has one.

## Errors

Refused by the check unless the service is `initialised`.
