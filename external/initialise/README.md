# initialise

Moves the service from booted to initialised: the mrepo made ready.

Nothing more yet: the place for a type's own actions when it is made ready.

## Signature

`initialise(exec)`: requested as `service/initialise`.

## Returns

What it did, said: `The service is <done>: its state is <state>.`; a
repeat: `The service was <state> already: nothing moved`, its hook run
again where it has one.

## Errors

Refused by the check unless the service is `booted`.
