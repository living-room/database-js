const test = require('ava')
const RoomDB = require('../src/RoomDB')

const gorogInitial = `gorog is a barbarian at 40, 50`

test('assertions are listened to', async t => {
  const room = new RoomDB()
  const client = room.client()

  let emissions = 0

  const subscription = new Promise((resolve, reject) => {
    client.subscribe('$name is a $class at $x, $y', ({assertions, retractions}) => {
      emissions++
      if (emissions === 2) {
        const gorogFact = assertions[0]
        t.deepEqual(retractions, [])
        t.deepEqual(gorogFact.name.word, 'gorog')
        t.deepEqual(gorogFact.class.word, 'barbarian')
        t.deepEqual(gorogFact.x.value, 40)
        t.deepEqual(gorogFact.y.value, 50)
        resolve()
      }
    })
  })

  client.assert(gorogInitial)
  await client.flushChanges()
  await subscription
})

test('retractions are listened to', async t => {
  const room = new RoomDB()
  const client = room.client()

  let emissions = 0

  const subscription = new Promise((resolve, reject) => {
    client.subscribe(['$name is a $class at $x, $y'], ({assertions, retractions, selections}) => {
      emissions++
      if (emissions === 3) {
        t.is(retractions.length, 1)
        const gorogFact = retractions[0]
        t.deepEqual(assertions, [])
        t.deepEqual(gorogFact.name.word, 'gorog')
        t.deepEqual(gorogFact.class.word, 'barbarian')
        t.deepEqual(gorogFact.x.value, 40)
        t.deepEqual(gorogFact.y.value, 50)
        resolve()
      }
    })
  })

  client.assert(gorogInitial)
  await client.flushChanges()
  client.retract(gorogInitial)
  await client.flushChanges()
  await subscription
})
