/* global describe, it */

import chai from 'chai'
import graphlib from 'graphlib'
import fs from 'fs'
import 'babel-register'
import _ from 'lodash'
import * as lambda from '../src/lambda'

var expect = chai.expect

var readFixture = (file) => {
  return graphlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/' + file)))
}

describe('Lambda functions', () => {
  it('`inner` reads the enclosed lambda function', () => {
    var lambdaNode = {
      meta: 'lambda',
      data: { meta: 'inner' }
    }

    expect(lambda.inner(lambdaNode)).to.deep.equal(lambdaNode.data)
  })

  it('`functionType` returns input args and return values', () => {
    var lambdaNode = {
      meta: 'lambda',
      data: {meta: 'inner', inputPorts: [{a: 'number'}], outputPorts: [{b: 'number'}]}
    }

    expect(lambda.functionType(lambdaNode)).to.deep.equal({from: [{a: 'number'}], to: [{b: 'number'}]})
  })

  it('`applyBacktrack` backtracks the lambda function of an application', () => {
    var applyGraph = readFixture('apply1.json')

    expect(lambda.applyBacktrack(applyGraph, 'a')).to.deep.equal({lambda: 'l', path: ['l', 'a']})
  })
})
