/* global describe, it */

import chai from 'chai'
import graphlib from 'graphlib'
import fs from 'fs'
import 'babel-register'
import * as lambda from '../src/lambda'
import _ from 'lodash'

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

  it('can determine the type of a lambda function', () => {
    var graph = readFixture('tailrecs.json')
    const lambdaType1 = lambda.getLambdaFunctionType(graph, 'fac_11:fac_tr_7:<_5_copy_1')
    expect(_.keys(lambdaType1.arguments)).to.have.length(2)
    expect(_.keys(lambdaType1.outputs)).to.have.length(1)

    const lambdaType2 = lambda.getLambdaFunctionType(graph, 'fac_11:fac_tr_7:-_2_copy_5')
    expect(_.keys(lambdaType2.arguments)).to.have.length(2)
    expect(_.keys(lambdaType2.outputs)).to.have.length(2)
  })

  it('processes map correctly', () => {
    var map = readFixture('map_fold.json')
    expect(_.keys(map.node('map2_15:lambda_9:lambda_9_impl:apply_11').outputPorts)).to.have.length(1)
    const resolved = lambda.resolveLambdaTypes(map)
    expect(_.keys(resolved.node('map2_15:lambda_9:lambda_9_impl:apply_11').outputPorts)).to.have.length(1)
  })
})

