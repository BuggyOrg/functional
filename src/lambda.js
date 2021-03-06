
import {walk, utils, graph as graphAPI} from '@buggyorg/graphtools'
import _ from 'lodash'

export function inner (node) {
  if (node.id !== 'functional/lambda') {
    throw new Error('Lambda.inner: Cannot process non lambda node' + JSON.stringify(node))
  } else {
    return node.data
  }
}

export function functionType (node) {
  var fn = inner(node)
  return {from: fn.inputPorts || [], to: fn.outputPorts || []}
}

export function backtrackLambda (graph, node) {
  return walk.walkBack(graph, node, (graph, node, port) => {
    var lambdaPort = graph.parent(node) && graph.node(graph.parent(node)).isLambda
    if (graph.node(node).id === 'functional/lambda') {
      return []
    }
    var functions = (_.invertBy(graph.node(node).inputPorts) || {function: []})['function']
    var generics = (_.invertBy(graph.node(node).inputPorts) || {generic: []})['generic']
    var ports = _.compact(_.map(_.flatten(_.compact(_.concat(functions, generics))), (v) => '' + v))
    if (!graph.node(node).atomic && port) {
      ports = _.filter(ports, (p) => p === port)
    }
    if (graph.node(node).id === 'functional/partial' && port === 'value') {
      return ['value']
    }
    if (lambdaPort) {
      return []
    }
    if (ports.length === 0) {
      return null
    }
    return ports
  }, {keepPorts: true})
}

export function backtrackApply (graph, node) {
  // var applyPaths = backtrackLambda(graph, node)
  return []
}

export function partialize (graph, lambdaNode, path) {
  // expect that every node on the path is a partial node
  if (_.filter(path, (p) => graph.node(p).meta !== 'partial').length !== 0) {
    throw new Error(`Cannot process a partial application path with non partials.
      Found non partials: ${_.filter(path, (p) => graph.node(p).meta !== 'partial')}`)
  }
  return _.reduce(path, (ports, p) => {
    var partial = graph.node(p)
    var port = partial.port
    return _.assign({}, ports,
      {
        input: _.reject(ports.input, (pname) => pname === port),
        portmap: _.concat(ports.portmap, [{port: port, partial: p}])
      })
  },
    {
      input: Object.keys(lambdaNode.value.inputPorts),
      output: Object.keys(lambdaNode.value.outputPorts),
      portmap: []
    })
}

var applyNodes = (graph) => {
  return _.filter(graph.nodes(), (n) => graph.node(n).id === 'functional/call')
}

export function findFunctionType (graph, meta) {
  if (meta.type === 'reference') {
    return meta
  }
  var node = {v: meta, value: graph.node(meta)}

  var mapGenerics = (type, key) => {
    if (type === 'generic') {
      return {type: 'type-ref', node: meta, port: key}
    }
    return type
  }

  var ins = _.mapValues(node.value.inputPorts, mapGenerics)
  var outs = _.mapValues(node.value.outputPorts, mapGenerics)

  var rKeys = _.keys(outs)
  return {
    type: 'function',
    arguments: ins,
    argumentOrdering: node.value.settings.argumentOrdering,
    outputs: outs,
    return: (rKeys.length === 1) ? outs[rKeys[0]] : outs
  }
}

export function getLambdaFunctionType (graph, node) {
  return findFunctionType(graph, graph.children(node)[0])
}

function isFunctionType (type) {
  return typeof (type) === 'object' && type.type === 'function'
}

export function portmapToEdges (graph, innerNode, portmap) {
  return _.flatten(_.map(portmap, (pm) => {
    var pred = walk.predecessor(graph, pm.partial, 'value')
    var edge = graph.edge({v: pred, w: pm.partial})
    return _.map(pred, (p) => ({v: p, w: innerNode.v, value: {inPort: pm.port, outPort: edge.outPort}}))
  }))
}

var updatePorts = (node, ports, apply) => {
  return _.mapValues(ports, (p, portName) => {
    var srcType = apply.types[apply.index]
    var type
    if (p === 'function' || p === 'generic' || p === 'function:partial') {
      if (p === 'generic' && apply.lambda.port !== portName) {
        return 'generic'
      }
      if (p === 'function:partial') {
        type = _.merge({}, _.omit(srcType, ['arguments', 'newArguments']), {arguments: srcType.newArguments})
      } else if (srcType.type === 'reference' && srcType.for.node === node && srcType.for.port === portName) {
        type = 'generic'
      } else {
        type = srcType
      }
    } else if (p === 'function:return') {
      type = srcType.return
      if (type === 'generic') {
        type = {type: 'type-ref', node: apply.implementation, port: _.keys(srcType.outputs)[0]}
      }
    } else if (p === 'function:arg') {
      var port = (srcType.partialize && srcType.partialize.port) ? srcType.partialize.port : _.keys(srcType.arguments)[0]
      type = srcType.arguments[port]
      if (type === 'generic') {
        type = {type: 'type-ref', node: apply.implementation, port: port}
      }
    }
    return type
  })
}

function partials (graph, apply) {
  return _.reduce(apply.path, (type, p) => {
    var pNode = graph.node(p.node)
    var lastType = _.cloneDeep((type.length > 0) ? _.last(type) : apply.type)
    if (lastType.newArguments) {
      lastType.arguments = lastType.newArguments
    }
    lastType = _.omit(lastType, ['partialize', 'newArguments'])
    if (pNode.id !== 'functional/partial' || p === _.last(apply.path)) {
      return type.concat(lastType)
    } else {
      var lambda = backtrackLambda(graph, {node: p.node, port: 'value'})
      if (lambda.length !== 0) {
        var impl = lambdaImplementation(graph, createApplyRule([lambda, p.node]))
        lambda = findFunctionType(graph, impl)
        var lambdaLambda = backtrackLambda(graph, {node: p.node, port: 'fn'})[0][0]
      } else if (utils.portType(graph, p.node, 'value') !== 'function:arg') {
        lambdaLambda = backtrackLambda(graph, {node: p.node, port: 'fn'})[0][0]
        lambda = utils.portType(graph, p.node, 'value')
      } else {
        lambda = null
      }
      return type.concat(_.merge({},
        lastType,
        {newArguments: _.omit(lastType.arguments, _.keys(lastType.arguments)[pNode.params.partial])},
        {partialize: {
          partial: p.node,
          port: _.keys(lastType.arguments)[pNode.params.partial],
          portIndex: pNode.params.partial,
          lambda: lambda,
          implementation: impl,
          applyTo: lambdaLambda
        }}))
    }
  }, [])
}

function lambdaImplementation (graph, res) {
  if (graph.node(res.lambda.node).params && graph.node(res.lambda.node).params.implementation) {
    return graph.node(res.lambda.node).params.implementation
  } else {
    return { type: 'reference', for: res.lambda, path: res.path }
  }
}

function createApplyRule (arr) {
  return {apply: arr[1], lambda: arr[0][0][0], path: arr[0][0]}
}

function partialFunctions (applys) {
  return _(applys)
    .map((a) => a.types)
    .flatten()
    .filter((t) => t.partialize && t.partialize.lambda)
    .value()
}

function resolveReferences (graph, pFuns, applys) {
  var partials = _.keyBy(pFuns, 'partialize.applyTo.node')
  return _.map(applys, (a) => {
    if (a.type.type === 'reference' && _.has(partials, graph.parent(a.type.for.node))) {
      var pType = _.omit(partials[graph.parent(a.type.for.node)])
      var type = pType.partialize.lambda
      var impl = pType.partialize.implementation
      return _.merge({},
        _.omit(a, ['type', 'types', 'implementation']),
        {
          implementation: impl,
          type: type,
          types: _.reduce(a.types, (types, t) => {
            var lastType = _.cloneDeep((types.length > 0) ? _.last(types) : type)
            if (lastType.newArguments) {
              lastType.arguments = lastType.newArguments
            }
            if (!t.partialize) {
              return _.concat(types, [lastType])
            } else {
              return types.concat(_.merge({},
                lastType,
                {newArguments: _.omit(lastType.arguments, _.keys(lastType.arguments)[t.partialize.portIndex])},
                {partialize: { port: _.keys(lastType.arguments)[t.portIndex] }}))
            }
          }, [])
        })
    } else if (a.type.type === 'reference') {
      var portType = utils.portType(graph, a.type.for.node, a.type.for.port)
      if (typeof (portType) === 'string' && portType !== 'generic') {
        return portType
      } else {
        return {type: 'type-ref', node: a.type.for.node, port: a.type.for.port}
      }
    }
    return a
  })
}

function applyLambdaTypes (graph) {
  var gr = graphAPI.importJSON(graph)
  return _.merge({}, graph, {
    nodes: _.map(graph.nodes, (n) => {
      if (n.value.id === 'functional/lambda' && n.value.outputPorts.fn === 'function') {
        return _.merge({}, n, {value: {outputPorts: {fn: findFunctionType(gr, n.value.params.implementation)}}})
      }
      return n
    })
  })
}

function hasUnfinishedFunctionEdges (graph) {
  var gr = graphAPI.importJSON(graph)
  return _.filter(graph.edges, (e) => {
    var vPort = utils.portType(gr, e.v, e.value.outPort)
    var wPort = utils.portType(gr, e.w, e.value.inPort)
    return ((vPort === 'generic' || vPort === 'function') && isFunctionType(wPort)) ||
      (isFunctionType(vPort) && (wPort === 'function' || wPort === 'generic'))
  }).length !== 0
}

function propagateFunctions (graph) {
  var gr = graphAPI.importJSON(graph)
  var changePorts = _.keyBy(_.compact(_.map(graph.edges, (e) => {
    var vPort = utils.portType(gr, e.v, e.value.outPort)
    var wPort = utils.portType(gr, e.w, e.value.inPort)
    if ((vPort === 'generic' || vPort === 'function') && isFunctionType(wPort)) {
      return {node: e.v, port: e.value.outPort, portType: utils.portDirectionType(gr, e.v, e.value.outPort), type: wPort}
    } else if (isFunctionType(vPort) && (wPort === 'function' || wPort === 'generic')) {
      return {node: e.w, port: e.value.inPort, portType: utils.portDirectionType(gr, e.w, e.value.inPort), type: vPort}
    }
  })), 'node')
  return _.merge({}, graph,
    {
      nodes: _.map(graph.nodes, (n) => {
        if (_.has(changePorts, n.v)) {
          n.value[changePorts[n.v].portType][changePorts[n.v].port] = changePorts[n.v].type
        }
        return n
      })
    })
}

function processApplications (graph, anodes) {
  var types = _(anodes)
    .map(_.partial(backtrackLambda, graph))
    .zip(anodes)
    .map((arr) => createApplyRule(arr))
    .map((res) => _.merge({}, res, {implementation: lambdaImplementation(graph, res)}))
    .map((res) => _.merge({}, res, {type: findFunctionType(graph, res.implementation)}))
    .map((res) => _.merge({}, res, {types: partials(graph, res)}))
    .value()
  var pFuns = partialFunctions(types)
  var ppaths = _(pFuns)
    .map((p) => {
      return { partial: p.partialize.partial, paths: backtrackLambda(graph, p.partialize.partial) }
    })
    .filter((p) => p.paths.length > 0)
    .map((p) => ({node: p.partial, port: 'value'}))
    .value()
  if (ppaths.length > 0) {
    graph = processApplications(graph, ppaths)
    types = _(anodes)
      .map(_.partial(backtrackLambda, graph))
      .zip(anodes)
      .map((arr) => createApplyRule(arr))
      .map((res) => _.merge({}, res, {implementation: lambdaImplementation(graph, res)}))
      .map((res) => _.merge({}, res, {type: findFunctionType(graph, res.implementation)}))
      .map((res) => _.merge({}, res, {types: partials(graph, res)}))
      .value()
    pFuns = partialFunctions(types)
  }
  types = resolveReferences(graph, pFuns, types)
  var args = _.concat([{}], _.map(types, (t) => _.fromPairs(_.map(t.path, (p, idx) => [p.node, _.merge({}, t, {index: idx})]))))
  var applys = _.merge.apply(null, args)
  var editGraph = graphAPI.toJSON(graph)
  editGraph = _.merge({}, editGraph, {
    nodes: _.map(editGraph.nodes, (n) => {
      if (!_.has(applys, n.v)) {
        return n
      } else if (_.find(anodes, (a) => a.node === n.v) && graph.node(n.v).id === 'functional/partial') {
        var appl = applys[n.v]
        return _.merge({}, n, {value:
        {
          inputPorts: _.merge({}, n.value.inputPorts, {value: appl.types[appl.index]})
        }})
      } else {
        return _.merge({}, n, {value:
        {
          inputPorts: updatePorts(n.v, n.value.inputPorts, applys[n.v]),
          outputPorts: updatePorts(n.v, n.value.outputPorts, applys[n.v]),
          partial: applys[n.v].types[applys[n.v].index].partialize
        }})
      }
    })
  })
  return graphAPI.importJSON(editGraph)
}

export function resolveLambdaTypes (graph) {
  var anodes = applyNodes(graph)
  var resGraph = processApplications(graph, anodes)
  var editGraph = graphAPI.toJSON(resGraph)
  editGraph = applyLambdaTypes(editGraph)
  var cnt = 0
  while (hasUnfinishedFunctionEdges(editGraph)) {
    editGraph = propagateFunctions(editGraph)
    cnt++
    if (cnt > 77) {
      console.error('maximum number of function propagations reached (77). Something is wrong.')
      process.exit(1)
    }
  }
  // console.log(hasUnfinishedFunctionEdges(editGraph))
  return graphAPI.importJSON(editGraph)
}
