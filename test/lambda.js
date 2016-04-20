/* global describe, it */

import chai from 'chai'
import graphlib from 'graphlib'
import fs from 'fs'
import 'babel-register'
import _ from 'lodash'
import * as lambda from '../src/lambda'
import {walk} from '@buggyorg/graphtools'

var expect = chai.expect

var readFixture = (file) => {
  return graphlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/' + file)))
}

describe('Lambda functions', () => {
/*
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
  it('`rewriteApply` redirects the input and output of the applied function correctly', () => {
    var rewGraph = lambda.rewriteApply(partialGraph, 'a')
    expect(walk.predecessor(rewGraph, 'a:add', 's1')).to.deep.equal(['a'])
    expect(walk.successor(rewGraph, 'a:add', 'sum')).to.deep.equal(['a'])
  })

  it('`partialize` returns a list of remaining ports', () => {
    var inner = partialGraph.node('l').data
    var remain = lambda.partialize(partialGraph, inner, ['p'])
    expect(remain.input).to.have.length(1)
  })

  it('`partialize` throws an error if the path contains a non partial', () => {
    expect(() => lambda.partialize(partialGraph, {}, ['a'])).to.throw(Error)
  })

  it('`rewriteApply` can redirect partial inputs to applied location', () => {
    var rewGraph = lambda.rewriteApply(partialGraph, 'a')
    expect(walk.predecessor(rewGraph, 'a:add', 's2')).to.deep.equal(['c'])
    expect(rewGraph.edge({v: 'c', w: 'a:add'}).outPort).to.equal('const1/output')
  })
  it('`applyBacktrack` backtracks the lambda function of an application', () => {
    expect(lambda.backtrackApply(applyGraph, 'a')).to.deep.equal({lambda: 'l', path: ['l', 'a']})
  })
*/
  var aGraph = readFixture('apply.json')
  it('`resolveLambdaTypes` finds function types for each apply call', () => {
    var resolvedGraph = lambda.resolveLambdaTypes(aGraph)
    expect(aGraph).to.be.ok
  })
})

