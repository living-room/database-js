'use strict'

import LocalClient from './LocalClient'
import { Id } from './terms'
import Fact from './Fact'
import EventEmitter from 'events'

function flatten (obj) {
  for (let prop in obj) {
    obj[prop] = obj[prop]
  }
  return obj
}

function difference (setA, setB) {
  let difference = setA
  for (let elem of setB) {
    difference.delete(elem)
  }
  return difference
}

export default class RoomDB extends EventEmitter {
  constructor () {
    super()
    this._factMap = new Map()
    this._subscriptions = new Set()

    this.on('newListener', (jsonPatternsString, _) => {
      this._subscriptions.add(jsonPatternsString)
    })
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
      for (let fact of this._facts) {
        const newEnv = Object.create(env)
        if (pattern.match(fact, newEnv)) {
          this._collectSolutions(patterns.slice(1), newEnv, solutions)
        }
      }
    }
  }

  _emitChanges (fn) {
    const subscriptions = this._subscriptions
    /**
     * beforeFacts: {
     *  '$name is at $x, $y': Set { }
     * }
     */
    const beforeFacts = new Map()
    subscriptions.forEach(jsonPatternString => {
      const jsonPatterns = JSON.parse(jsonPatternString)
      const solutions = this.select(...jsonPatterns)
      beforeFacts.set(jsonPatternString, new Set(solutions.map(JSON.stringify)))
    })

    // assert('gorog is at 1, 2')
    fn()

    /**
     * afterFacts: {
     *  '$name is at $x, $y': Set{ {name: 'gorog', x: 1, y: 2} }
     * }
     */
    const afterFacts = new Map()
    subscriptions.forEach(jsonPatternString => {
      const jsonPatterns = JSON.parse(jsonPatternString)
      const solutions = this.select(...jsonPatterns)
      afterFacts.set(jsonPatternString, new Set(solutions.map(JSON.stringify)))
    })

    /**
     * {
     *    assertions: [ {name: 'gorog', x: 1, y: 2} ]
     * }
     */
    subscriptions.forEach(jsonPatternString => {
      const before = beforeFacts.get(jsonPatternString)
      const after = afterFacts.get(jsonPatternString)

      const assertions = Array.from(difference(after, before)).map(JSON.parse)
      const retractions = Array.from(difference(before, after)).map(JSON.parse)

      if (assertions.length + retractions.length) {
        this.emit(jsonPatternString, {
          pattern: jsonPatternString,
          assertions,
          retractions
        })
      }
    })
  }

  assert (...args) {
    const assert = this._assert.bind(this, ...args)
    this._emitChanges(assert)
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
    const a = new Set()
    a.keys
    this._factMap.set(fact.toString(), fact)
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
      factsToRetract.forEach(fact => this._factMap.delete(fact.toString()))
      return factsToRetract.length
    } else {
      return this._factMap.delete(pattern.toString()) ? 1 : 0
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
