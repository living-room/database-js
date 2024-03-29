import test from 'ava'
import RoomDB from '../src/RoomDB.js'

const gorogInitial = '#gorog is a barbarian at 40, 50'
const gorogMoves = '#gorog is a barbarian at 99, 11'

test.beforeEach(t => {
  t.context.client = (new RoomDB()).client()
})

test('assert adds to the log', async t => {
  const { client } = t.context
  client.assert(gorogInitial)
  await client.flushChanges()
  t.deepEqual(await client.getAllFacts(), [ gorogInitial ])
})

test('retract removes from the log', async t => {
  const { client } = t.context
  client.assert(gorogInitial)
  await client.flushChanges()
  client.retract(gorogInitial)
  await client.flushChanges()
  t.deepEqual(await client.getAllFacts(), [ ])
})

test('retracts and asserts batch correctly', async t => {
  const { client } = t.context
  client.assert(gorogInitial)
  await client.flushChanges()
  client.retract(gorogInitial)
  client.assert(gorogMoves)
  await client.flushChanges();
  t.deepEqual(await client.getAllFacts(), [ gorogMoves ])
})

test('select grabs the right fact', async t => {
  const { client } = t.context
  client.assert(gorogInitial)
  await client.flushChanges()
  client.retract(gorogInitial)
  client.assert(gorogMoves)
  await client.flushChanges();
  t.deepEqual(await client.getAllFacts(), [ gorogMoves ])
  client
    .select('$name is a $what at $x, $y')
    .do(({ name, what, x, y }) => {
      t.is(name.name, 'gorog')
      t.is(what.value, 'barbarian')
      t.is(x, 99)
      t.is(y, 11)
    })
})
