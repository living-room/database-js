import LocalClient from './LocalClient.js'
import { Id } from './terms.js'
import Fact from './Fact.js'
import EventEmitter from 'events'

/**
 * This flatten function keeps the Object prototype
 * If you try Object.assign({}, ...obj), it only keeps "plain" data,
 * so callbacks like `do`, and `doAll` will be preserved
 *
 * See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign#properties_on_the_prototype_chain_and_non-enumerable_properties_cannot_be_copied
 */

function flatten (object) {
  const flattened = {}
  for (const prop in object) {
    flattened[prop] = object[prop]
  }
  return flattened
}

function difference (setA, setB) {
  const difference = new Set(setA)
  for (const elem of setB) {
    difference.delete(elem)
  }
  return difference
}

export default class RoomDB extends EventEmitter {
  constructor () {
    super()
    this._factMap = new Map()
    this._subscriptions = new Set()

    this.setMaxListeners(Infinity)

    this.on('newListener', (event, callback) => {
      this._updateListener(
        event,
        callback,
        Set.prototype.add.bind(this._subscriptions)
      )
    })

    this.on('removeListener', (event, callback) => {
      this._updateListener(
        event,
        callback,
        Set.prototype.delete.bind(this._subscriptions)
      )
    })
  }

  _updateListener (event, fn, method) {
    const patternMatch = event.match(/pattern:(.+)/)
    if (!patternMatch) return
    const jsonPatternsString = patternMatch[1]
    if (!method) return
    method(jsonPatternsString)
    const jsonPatterns = JSON.parse(jsonPatternsString)
    const assertions = this.select(...jsonPatterns)
    const retractions = []
    fn({ assertions, retractions })
  }

  select (...jsonPatterns) {
    const patterns = jsonPatterns.map(jsonPattern => Fact.fromJSON(jsonPattern))
    const solutions = []
    this._collectSolutions(patterns, Object.create(null), solutions)
    return solutions.map(flatten)
  }

  _collectSolutions (patterns, env, solutions) {
    if (patterns.length === 0) {
      solutions.push(env)
    } else {
      const pattern = patterns[0]
      for (const fact of this._facts) {
        const newEnv = Object.create(env)
        if (pattern.match(fact, newEnv)) {
          this._collectSolutions(patterns.slice(1), newEnv, solutions)
        }
      }
    }
  }

  _emitChanges (fn) {
    const subscriptions = this._subscriptions

    const beforeFacts = new Map()
    subscriptions.forEach(jsonPatternString => {
      const jsonPatterns = JSON.parse(jsonPatternString)
      const solutions = this.select(...jsonPatterns)
      beforeFacts.set(jsonPatternString, new Set(solutions.map(JSON.stringify)))
    })

    fn()

    const afterFacts = new Map()
    subscriptions.forEach(jsonPatternString => {
      const jsonPatterns = JSON.parse(jsonPatternString)
      const solutions = this.select(...jsonPatterns)
      afterFacts.set(jsonPatternString, new Set(solutions.map(JSON.stringify)))
    })

    subscriptions.forEach(jsonPatternString => {
      const before = beforeFacts.get(jsonPatternString)
      const after = afterFacts.get(jsonPatternString)

      const assertions = Array.from(difference(after, before)).map(JSON.parse)
      const retractions = Array.from(difference(before, after)).map(JSON.parse)
      if (assertions.length + retractions.length > 0) {
        const data = {
          pattern: jsonPatternString,
          assertions,
          retractions
        }
        this.emit(`pattern:${jsonPatternString}`, data)
      }
    })
  }

  process (clientId, messages) {
    const processQueue = messages => {
      messages.forEach(message => {
        if (message.assert) this._assert(clientId, message.assert)
        if (message.retract) this._retract(clientId, message.retract)
      })
    }
    this._emitChanges(processQueue.bind(this, messages))
  }

  assert (...args) {
    const assertion = this._assert.bind(this, ...args)
    this._emitChanges(assertion)
  }

  _assert (clientId, factJSON) {
    if (factJSON === undefined) {
      throw new Error('factJSON is undefined')
    }
    const fact = Fact.fromJSON(factJSON)

    if (fact.hasVariablesOrWildcards()) {
      throw new Error('cannot assert a fact that has variables or wildcards!')
    }
    fact.asserter = clientId
    const factString = fact.toString()
    this._factMap.set(factString, fact)
    this.emit('assert', factString)
  }

  retract (...args) {
    const retract = this._retract.bind(this, ...args)
    this._emitChanges(retract)
  }

  _retract (clientId, factJSON) {
    const pattern = Fact.fromJSON(factJSON)
    if (pattern.hasVariablesOrWildcards()) {
      const factsToRetract = this._facts.filter(fact =>
        pattern.match(fact, Object.create(null))
      )
      factsToRetract.forEach(fact => {
        this._factMap.delete(fact.toString())
        this.emit('retract', pattern.toString())
      })
      return factsToRetract.length
    } else {
      if (this._factMap.delete(pattern.toString())) {
        this.emit('retract', pattern.toString())
        return 1
      } else {
        return 0
      }
    }
  }

  retractEverythingAbout (clientId, name) {
    const id = new Id(name)
    const emptyEnv = Object.create(null)
    const factsToRetract = this._facts.filter(fact =>
      fact.terms.some(term => id.match(term, emptyEnv))
    )
    factsToRetract.forEach(fact => this._factMap.delete(fact.toString()))
    return factsToRetract.length
  }

  retractEverythingAssertedBy (clientId) {
    const factsToRetract = this._facts.filter(
      fact => fact.asserter === clientId
    )
    factsToRetract.forEach(fact => this._factMap.delete(fact.toString()))
    return factsToRetract.length
  }

  get _facts () {
    return Array.from(this._factMap.values())
  }

  getAllFacts () {
    return this._facts.map(fact => fact.toString())
  }

  toString () {
    return this._facts
      .map(fact => '<' + fact.asserter + '> ' + fact.toString())
      .join('\n')
  }

  client (id = 'local-client') {
    return new LocalClient(this, id)
  }
}
