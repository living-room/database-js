import test from 'ava'
import RoomDB from '../src/RoomDB.js'

const gorogInitial = `gorog is a barbarian at 40, 50`

test.beforeEach(t => {
  const db = new RoomDB()
  t.context.room = db.client()
})

test('assertions are listened to', async t => {
  const { room } = t.context
  t.plan(4)

  let emissions = 0

  new Promise((resolve, reject) => {
    room.subscribe(`$name is a $class at $x, $y`, ({ assertions, retractions }) => {
      if (emissions === 0) {
        t.deepEqual(assertions, [])
        t.deepEqual(retractions, [])
      } else if (emissions === 1) {
        t.deepEqual(assertions, [{
          name: { word: 'gorog' },
          class: { word: 'barbarian' },
          x: { value: 40 },
          y: { value: 50 }
        }])
        t.deepEqual(retractions, [])
        resolve()
      }
      emissions++
    })
  })

  room.assert(gorogInitial)
  await room.flushChanges()
})

test('multisubscribe', async t => {
  const { room } = t.context
  t.plan(4)

  let emissions = 0

  new Promise((resolve, reject) => {
    room.subscribe(`$name is very ready`, `$name is $what`, ({assertions, retractions}) => {
      if (emissions === 0) {
        t.deepEqual(assertions, [])
        t.deepEqual(retractions, [])
      } else if (emissions === 1) {
        t.deepEqual(assertions, [{
          name: { word: 'gorog' },
          what: { word: 'cool' },
        }])
        t.deepEqual(retractions, [])
        resolve()
      }
      emissions++
    })
  })

  room.assert('gorog is very ready')
  room.assert('gorog is cool')
  await room.flushChanges()

})

test('retractions are listened to', async t => {
  const { room } = t.context
  t.plan(2)

  let emissions = 0

  new Promise((resolve, reject) => {
    room.subscribe(`$name is a $class at $x, $y`, ({assertions, retractions }) => {
      if (emissions === 2) {
        t.deepEqual(assertions, [])
        t.deepEqual(retractions, [{
          name: { word: 'gorog' },
          class: { word: 'barbarian' },
          x: { value: 40 },
          y: { value: 50 }
        }])
        resolve()
      }
      emissions++
    })
  })

  room.assert(gorogInitial)
  await room.flushChanges()
  room.retract(gorogInitial)
  await room.flushChanges()
})
