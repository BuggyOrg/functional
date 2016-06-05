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

/*
  it('`rewriteApply` places the lambda function in the place of apply', () => {
    var rewGraph = lambda.rewriteApply(applyGraph, 'apply')
    expect(rewGraph.nodes()).to.include('apply:inc')
  })

  it('`rewriteApply` redirects inputs to the lambda function', () => {
    var rewGraph = lambda.rewriteApply(applyGraph, 'apply')
    expect(rewGraph.edges().length).to.equal(applyGraph.edges().length + 2)
    expect(rewGraph.predecessors('apply:inc')).to.include('apply')
    expect(rewGraph.successors('apply:inc')).to.include('apply')
  })*/
/*
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
    expect(resolvedGraph).to.be.ok
  })

/*
  it('`resolveLambdaTypes` can set functions on the path to apply', () => {
    var mapGraph = lambda.resolveLambdaTypes(readFixture('map.json'))
    expect(mapGraph.node('mapInc:upv').inputPorts.value).to.be.an('object')
    expect(mapGraph.node('mapInc:upv').outputPorts.stream).to.be.an('object')
  })*/
/*
  it('`resolveLambdaTypes` can handle generic lambda input values', () => {
    var genGraph = lambda.resolveLambdaTypes(readFixture('apply_generic.json'))
    expect(genGraph.node('apply').inputPorts.value).to.equal('type-ref=math/inc@i')
  })

  it('`resolveLambdaTypes` can handle generic lambda return values', () => {
    var genGraph = lambda.resolveLambdaTypes(readFixture('apply_generic.json'))
    expect(genGraph.node('apply').outputPorts.result).to.be.an('object')
    expect(genGraph.node('apply').outputPorts.result.type).to.equal('type-ref')
  })

  it('`resolveLambdaTypes` can handle partial applications', () => {
    var genGraph = lambda.resolveLambdaTypes(readFixture('partial_generic.json'))
    expect(genGraph.node('apply').inputPorts.value).to.equal('int')
    expect(genGraph.node('partial').outputPorts.result).to.be.an('object')
  })

  it('`resolveLambdaTypes` can handle multiple partial applications', () => {
    var genGraph = lambda.resolveLambdaTypes(readFixture('partial_generic_multi.json'))
    expect(genGraph.node('apply').inputPorts.value).to.equal('int32')
    expect(genGraph.node('partial').outputPorts.result).to.be.an('object')
    expect(genGraph.node('partial2').outputPorts.result).to.be.an('object')
  })*/
})

