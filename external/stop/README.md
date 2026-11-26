# stop

Moves the service from started back to initialised: the external API closed.

## Signature

`stop(exec)`: requested as `service/stop`.

## Returns

What it did, said: `The service is <done>: its state is <state>.`; a
repeat: `The service was <state> already: nothing moved`, its hook run
again where it has one.

## Errors

Refused by the check unless the service is `started`.
