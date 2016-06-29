/* global describe, it */

import chai from 'chai'
import graphlib from 'graphlib'
import fs from 'fs'
import 'babel-register'
import * as lambda from '../src/lambda'

var expect = chai.expect

var readFixture = (file) => {
  return graphlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/' + file)))
}

describe('Lambda functions', () => {

  it('`inner` reads the enclosed lambda function', () => {
    var lambdaNode = {
      id: 'functional/lambda',
      data: { meta: 'inner' }
    }

    expect(lambda.inner(lambdaNode)).to.deep.equal(lambdaNode.data)
  })

  it('`functionType` returns input args and return values', () => {
    var lambdaNode = {
      id: 'functional/lambda',
      data: {meta: 'inner', inputPorts: [{a: 'number'}], outputPorts: [{b: 'number'}]}
    }

    expect(lambda.functionType(lambdaNode)).to.deep.equal({from: [{a: 'number'}], to: [{b: 'number'}]})
  })

  var applyGraph = readFixture('apply1.json')
  it('`backtrackLambda` returns the path to a lambda function from a node', () => {
    var lambdaPath = lambda.backtrackLambda(applyGraph, 'apply')
    expect(lambdaPath).to.have.length(1)
    expect(lambdaPath[0]).to.have.length(2)
    expect(lambdaPath[0][0].node).to.equal('lambda_inc')
  })

  var aGraph = readFixture('apply.json')
  it('`resolveLambdaTypes` finds function types for each apply call', () => {
    var resolvedGraph = lambda.resolveLambdaTypes(aGraph)
    expect(resolvedGraph).to.be.ok
  })
})

