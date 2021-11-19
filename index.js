
const n = require('@lancejpollard/normalize-ast.js')
const {
  createTask,
  createHostZone,
  createBase,
  createCall,
  createSave,
  createSize,
  createText,
  createBind,
  createCallSave,
} = require('./create')

const transforms = {
  ExpressionStatement: transformExpressionStatement,
  VariableDeclaration: transformVariableDeclaration,
  AssignmentExpression: transformAssignmentExpression,
  FunctionExpression: transformFunctionExpression,
  Literal: transformLiteral,
  BinaryExpression: transformBinaryExpression,
  Identifier: transformIdentifier,
  CallExpression: transformCallExpression,
  MemberExpression: transformMemberExpression,
}

const binaries = {
  '+': 'add',
  '-': 'subtract',
}

module.exports = transform

function transform(source) {
  const node = n.parse(source)
  const nodes = []
  const scope = { index: 0 }
  node.body.forEach(bd => {
    const t = call(transforms, bd.type, bd, scope)
    nodes.push(...t)
  })
  return nodes
}

function transformPath(node) {

}

function transformMemberExpression(node, scope) {

}

function transformCallExpression(node, scope) {
  const caller = call(transforms, node.callee.type, node.callee, scope)
  const bind = []
  node.arguments.forEach(arg => {
    bind.push(createBind('x', call(transforms, arg.type, arg, scope)))
  })
  caller.bind = bind
  return caller
}

function transformIdentifier(node, scope) {
  // console.log(node)
}

function transformBinaryExpression(node, scope) {
  const name = binaries[node.operator]
  const bind = []
  const left = call(transforms, node.left.type, node.left, scope)
  const right = call(transforms, node.right.type, node.right, scope)
  bind.push(createBind('left', left))
  bind.push(createBind('right', right))
  return createCall(name, bind)
}

function transformLiteral(node, scope) {
  switch (typeof node.value) {
    case 'number': return createSize(node.value)
    case 'string': return createText(node.value)
  }
}

function transformAssignmentExpression(node, scope) {
  const left = transformPath(node.left)
  if (node.right.type === 'FunctionExpression') {
    return transformFunctionExpression(node.right, scope)
  }
  return createSave(left)
}

function transformFunctionExpression(node, scope) {
  const base = []
  const name = `tmp${scope.index++}`
  node.params.forEach(param => {
    base.push(createBase(param.name))
  })
  const zone = []
  node.body.body.forEach(bd => {
    const t = call(transforms, bd.type, bd, scope)
    zone.push(...t)
  })
  return createTask(name, base, zone)
}

function transformExpressionStatement(node, scope) {
  return call(transforms, node.expression.type, node.expression, scope)
}

function transformVariableDeclaration(node, scope) {
  const list = []
  node.declarations.forEach(dec => {
    const init = call(transforms, dec.init.type, dec.init, scope)
    if (init.form === 'call') {
      list.push(createHostZone(dec.id.name))
      init.zone.push(createCallSave(dec.id.name))
      list.push(init)
    } else {
      list.push(createHostZone(dec.id.name, init))
    }
  })
  return list
}

function call(obj, method, ...args) {
  if (!obj.hasOwnProperty(method)) {
    throw new Error(`Missing method ${method}`)
  }

  return obj[method](...args)
}
