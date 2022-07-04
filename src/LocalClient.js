import parse from '@living-room/parser-js'
import { Term } from './terms.js'
import EventEmitter from 'events'
import util from 'util'

const MAX_PARSE_CACHE_SIZE = 1000

export default class LocalClient extends EventEmitter {
  constructor (db, id) {
    super()
    this._db = db
    this._id = id
    this._parseCache = new Map()
    this._messages = []

    // TODO: If there's a way for clients to be destroyed, they need to .off() these listeners.
    db.on('assert', changes => this.emit('assert', changes))
    db.on('retract', changes => this.emit('retract', changes))
  }

  assert (factString, ...fillerValues) {
    const fact = this._toJSONFactOrPattern(factString, ...fillerValues)
    this._messages.push({ assert: fact })
  }

  retract (factString, ...fillerValues) {
    const fact = this._toJSONFactOrPattern(factString, ...fillerValues)
    this._messages.push({ retract: fact })
  }

  async flushChanges () {
    this._db.process(this._id, this._messages)
    this._messages = []
  }

  subscribe (...patterns) {
    const callback = patterns.splice(patterns.length - 1)[0]
    const jsonPatterns = patterns.map(patternString =>
      this._toJSONFactOrPattern(patternString)
    )
    return this._db.on(`pattern:${JSON.stringify(jsonPatterns)}`, callback)
  }

  select (...patternStrings) {
    const patterns = patternStrings.map(
      p =>
        p instanceof Array
          ? this._toJSONFactOrPattern(...p)
          : this._toJSONFactOrPattern(p)
    )
    const solutions = this._db.select(...patterns)
    const results = {
      async doAll (callbackFn) {
        await callbackFn(solutions)
        return results
      },
      async do (callbackFn) {
        for (const solution of solutions) {
          for (const name in solution) {
            // force serialization and deserialization to simulate going over the network
            const json = JSON.parse(JSON.stringify(solution[name]))
            solution[name] = Term.fromJSON(json).toRawValue()
          }
          await callbackFn(solution)
        }
        return results
      },
      async count () {
        return solutions.length
      },
      async isEmpty () {
        return solutions.length === 0
      },
      async isNotEmpty () {
        return solutions.length > 0
      }
    }
    return results
  }

  async immediatelyRetractEverythingAbout (name) {
    return this._db.retractEverythingAbout(this._id, name)
  }

  async immediatelyRetractEverythingAssertedByMe () {
    return this._db.retractEverythingAssertedBy(this._id)
  }

  async getAllFacts () {
    return this._db.getAllFacts()
  }

  toString () {
    return `[LocalClient ${this._id}]`
  }

  _toJSONFactOrPattern (factOrPatternString, ...fillerValues) {
    if (arguments.length === 0) {
      throw new Error('not enough arguments!')
    }
    if (typeof factOrPatternString !== 'string') {
      throw new Error(
        `factOrPatternString must be a string!, got ${util.inspect(
          factOrPatternString
        )}`
      )
    }
    let terms = this._parse(factOrPatternString)
    if (fillerValues.length > 0) {
      terms = terms.slice()
    }
    for (let idx = 0; idx < terms.length; idx++) {
      const term = terms[idx]
      if (term.hasOwnProperty('hole')) {
        if (fillerValues.length === 0) {
          throw new Error('not enough filler values!')
        }
        terms[idx] = this._toJSONTerm(fillerValues.shift())
      }
    }
    if (fillerValues.length > 0) {
      throw new Error('too many filler values!')
    }
    return terms
  }

  _toJSONTerm (value) {
    return { value }
  }

  _parse (factOrPatternString) {
    if (this._parseCache.has(factOrPatternString)) {
      return this._parseCache.get(factOrPatternString)
    } else {
      this._clearParseCacheIfTooBig()
      const terms = parse(factOrPatternString)
      this._parseCache.set(factOrPatternString, terms)
      return terms
    }
  }

  _clearParseCacheIfTooBig () {
    if (this._parseCache.size > MAX_PARSE_CACHE_SIZE) {
      this.clearParseCache()
    }
  }

  clearParseCache () {
    this._parseCache.clear()
  }
}
