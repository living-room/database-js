# living-room database-js

living-room database-js is a Datalog-style database inspired by the implementation of the [Dynamicland][] project. It enables programmers to represent facts using natural language, with a syntax adapted from [alexwarth][]'s [NL-Datalog project][].

See [tests][] for examples of what can be done

# todo

samples vs. wishes

> create a distinction between the state of the world, and things we want changed (input, and output)

evidence

> how can we see the 'call stack' of how a fact came to be

include "world time" in samples

> do we need this?

be more careful with client IDs

> prevent multiple clients from having the same id

consider space-insensitive matching for facts

> (would need a canonical representation to use as keys for factMap)

think about "primary keys"?

> like #ids


[Dynamicland]: https://dynamiclang.org
[NL-Datalog project]: https://github.com/harc/nl-datalog
[alexwarth]: https://github.com/alexwarth
[RoomDB]: https://github.com/alexwarth/RoomDB
[tests]: ./tests
