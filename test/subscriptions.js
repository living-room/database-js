import test from 'ava'
import RoomDB from '../src/RoomDB.js'

const gorogInitial = 'gorog is a barbarian at 40, 50'

test.beforeEach(t => {
  const db = new RoomDB()
  t.context.client = db.client()
})

test('assertions are listened to', async t => {
  const { client } = t.context
  t.plan(4)

  let callbacks = 0

  return new Promise((resolve, reject) => {
    client.on('error', reject)

    client.subscribe('$name is a $class at $x, $y', ({ assertions, retractions }) => {
      if (callbacks === 0) {
        t.deepEqual(assertions, [])
        t.deepEqual(retractions, [])
      }

      if (callbacks === 1) {
        t.deepEqual(assertions, [{
          name: { word: 'gorog' },
          class: { word: 'barbarian' },
          x: { value: 40 },
          y: { value: 50 }
        }])
        t.deepEqual(retractions, [])
        resolve()
      }
      callbacks++
    })

    client.assert(gorogInitial).flushChanges()
  })
})

test('multisubscribe', async t => {
  const { client } = t.context
  t.plan(4)

  let emissions = 0

  return new Promise((resolve, reject) => {
    client.on('error', reject)

    client.subscribe('$name is very ready', '$name is $what', ({ assertions, retractions }) => {
      if (emissions === 0) {
        t.deepEqual(assertions, [])
        t.deepEqual(retractions, [])
      } else if (emissions === 1) {
        t.deepEqual(assertions, [{
          name: { word: 'gorog' },
          what: { word: 'cool' }
        }])
        t.deepEqual(retractions, [])
        resolve()
      }
      emissions++
    })

    client.assert('gorog is very ready')
    client.assert('gorog is cool')
    client.flushChanges()
  })
})

test('retractions are listened to', async t => {
  const { client } = t.context
  t.plan(2)

  let callbacks = 0

  const promise = new Promise((resolve, reject) => {
    client.on('error', reject)

    client.subscribe('$name is a $class at $x, $y', ({ assertions, retractions }) => {
      if (callbacks === 2) {
        t.deepEqual(assertions, [])
        t.deepEqual(retractions, [{
          name: { word: 'gorog' },
          class: { word: 'barbarian' },
          x: { value: 40 },
          y: { value: 50 }
        }])
        resolve()
      }
      callbacks++
    })
  })

  client.assert(gorogInitial)
  await client.flushChanges()
  client.retract(gorogInitial)
  await client.flushChanges()
})
