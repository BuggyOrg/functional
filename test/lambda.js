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

  var applyGraph = readFixture('apply1.json')
  it('`backtrackLambda` returns the path to a lambda function from a node', () => {
    var lambdaPath = lambda.backtrackLambda(applyGraph, 'a')
    expect(lambdaPath).to.have.length(1)
    expect(lambdaPath[0]).to.have.length(2)
    expect(lambdaPath[0][0]).to.equal('l')
  })

  it('`rewriteApply` places the lambda function in the place of apply', () => {
    var rewGraph = lambda.rewriteApply(applyGraph, 'a')
    expect(rewGraph.nodes()).to.include('a:inc')
  })

  it('`rewriteApply` redirects inputs to the lambda function', () => {
    var rewGraph = lambda.rewriteApply(applyGraph, 'a')
    expect(rewGraph.edges().length).to.equal(applyGraph.edges().length + 2)
    expect(rewGraph.predecessors('a:inc')).to.include('a')
    expect(rewGraph.successors('a:inc')).to.include('a')
  })

  var partialGraph = readFixture('partial.json')
  it('prints', () => {
    console.log(JSON.stringify(graphlib.json.write(partialGraph), null, 2))
    var rewGraph = lambda.rewriteApply(partialGraph, 'a')
    console.log(JSON.stringify(graphlib.json.write(rewGraph), null, 2))
  })

  it('`partialize` returns a list of remaining ports', () => {
    var inner = partialGraph.node('l').data
    var remain = lambda.partialize(partialGraph, inner, ['p'])
    console.log(JSON.stringify(remain, null, 2))
    expect(remain.input).to.have.length(1)
  })

  it('`partialize` throws an error if the path contains a non partial', () => {
    expect(() => lambda.partialize(partialGraph, {}, ['a'])).to.throw(Error)
  })
/*
  it('`applyBacktrack` backtracks the lambda function of an application', () => {
    expect(lambda.backtrackApply(applyGraph, 'a')).to.deep.equal({lambda: 'l', path: ['l', 'a']})
  })
*/
})
