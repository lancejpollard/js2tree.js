
const n = require('@lancejpollard/normalize-ast.js')
const to = require('to-case')
const {
  createTask,
  createBase,
  createCall,
  createSave,
  createMark,
  createText,
  createBind,
  createWalk,
  createCallSave,
} = require('./create')

// const transforms = buildTransforms(Type)

const transforms = {
  VariableDeclaration: transformVariableDeclarationStandalone,
  AssignmentExpression: transformAssignmentExpression,
  FunctionExpression: transformFunctionExpression,
  Literal: transformLiteral,
  BinaryExpression: transformBinaryExpression,
  Identifier: transformIdentifier,
  CallExpression: transformCallExpression,
  MemberExpression: transformMemberExpression,
  ReturnStatement: transformReturnStatement,
  IfStatement: transformIfStatement,
  BlockStatement: transformBlockStatement,
  WhileStatement: transformWhileStatement,
  BreakStatement: transformBreakStatement,
  // ContinueStatement: transformContinueStatement,
  LogicalExpression: transformLogicalExpression,
  ObjectExpression: transformObjectExpression,
  Property: transformProperty,
  ArrayExpression: transformArrayExpression,
  SpreadElement: transformSpreadElement,
  FunctionDeclaration: transformFunctionDeclaration,
  UnaryExpression: transformUnaryExpression,
  UpdateExpression: transformUpdateExpression,
  // EmptyStatement: transformEmptyStatement,
  // ThrowStatement: transformThrowStatement,
  NewExpression: transformNewExpression,
  ThisExpression: transformThisExpression,
  // ForInStatement: transformForInStatement,
  // SwitchStatement: transformSwitchStatement,
  // TemplateLiteral: transformTemplateLiteral,
  // TemplateElement: transformTemplateElement,
  // TryStatement: transformTryStatement,
  // CatchClause: transformCatchClause,
  AssignmentPattern: transformAssignmentPattern,
  // SwitchCase: transformSwitchCase,
  // ClassDeclaration: transformClassDeclaration,
  // ClassBody: transformClassBody,
  // MethodDefinition: transformMethodDefinition,
  LabeledStatement: transformLabeledStatement,
}

const binaries = {
  '+': 'add',
  '-': 'subtract',
  '*': 'multiply',
  '/': 'divide',
  '||': 'unite',
  '&&': 'intersect',
  '&': 'intersect-bitwise',
  '|': 'unite-bitwise',
  '>>>': 'shift-head-unsigned',
  '>>': 'shift-head',
  '<<': 'shift-base',
  '+=': 'add',
  '-=': 'subtract',
  '*=': 'multiply',
  '/=': 'divide',
  '%=': 'remainder',
  '**=': 'exponentiate',
  '<<=': 'base-shift',
  '>>=': 'head-shift',
  '>>>=': 'head-shift-unsigned',
  '&=': 'intersect-bitwise',
  '^=': 'oppose-bitwise',
  '|=': 'unite-bitwise',
  '??': 'nullish',
  '^': 'oppose-bitwise',
  '==': 'is-equal',
  '===': 'is-strictly-equal',
  '!==': 'is-not-strictly-equal',
  '!=': 'is-not-equal',
  '<': 'is-below',
  '>': 'is-above',
  '<=': 'is-max',
  '>=': 'is-min',
  '%': 'remainder',
  'instanceof': 'get-instance-of'
}

const unaries = {
  '!': 'oppose',
  'typeof': 'get-type-of',
  '~': 'bitflip',
  '-': 'negate',
  '+': 'numeralize',
  '++': 'increment',
  '--': 'decrement',
  'delete': 'delete'
}

module.exports = transform

function transform(source) {
  const node = n.normalize(n.parse(source))
  const nodes = []
  const scope = { index: { value: 0 }, names: {}, fork: [] }
  node.body.forEach(bd => {
    const t = transformBodyNode(bd, scope)
    if (Array.isArray(t)) {
      nodes.push(...t)
    } else if (t) {
      nodes.push(t)
    }
  })
  nodes.forEach(node => walk(node, scope))
  return nodes
}

function normalizeName(term, scope) {
  if (!term.term) return
  if (typeof scope.names[term.term] !== 'string') {
    scope.names[term.term] = `${term.at ? '@' : ''}${to.slug(term.term.replace(/_/g, ''))}`
  }
  term.term = scope.names[term.term]
  return term
}

function walk(node, scope) {
  if (!node || typeof node !== 'object') {
    return
  }

  if (node.form === 'term') {
    normalizeName(node, scope)
  }

  Object.keys(node).forEach(key => {
    const val = node[key]
    if (Array.isArray(val)) {
      val.forEach(v => walk(v, scope))
    } else {
      walk(val, scope)
    }
  })
}

function transformBodyNode(node, scope) {
  return call(transforms, node.type, node, scope)
}

function toTerm(term, at) {
  if (!term) throw new Error('Missing term')
  const obj = {
    form: 'term',
    term,
    at
  }
  return obj
}

function toRead(line) {
  const obj = {
    form: 'read',
    line
  }
  return obj
}

function toSite(term) {
  if (!term) throw new Error('Missing term')
  const obj = {
    form: 'site',
    term
  }
  return obj
}

function transformName(key, x = binaries) {
  if (!x.hasOwnProperty(key)) throw new Error(key)
  return x[key]
}

function transformIdentifier(node, scope) {
  return toTerm(node.name)
}

function transformLiteral(node, scope) {
  switch (typeof node.value) {
    case 'number': return createMark(node.value)
    case 'string': return createText(node.raw.substr(1, node.raw.length - 2))
    case 'boolean': return toTerm(String(node.value))
  }
}

function transformFunctionExpression(node, scope) {
  const take = []
  const id = node.id && call(transforms, node.id.type, node.id, scope)
  const name = id ?? { form: 'term', term: `tmp${scope.index.value++}` }
  node.params.forEach(param => {
    const p = call(transforms, param.type, param, scope)
    take.push(p)
  })
  const zone = []
  node.body.body.forEach(bd => {
    const t = call(transforms, bd.type, bd, scope)
    if (Array.isArray(t)) {
      zone.push(...t)
    } else {
      zone.push(t)
    }
  })
  return createTask(name, take, zone)
}

function transformCallExpression(node, scope) {
  const nest = call(transforms, node.callee.type, node.callee, scope)
  const bind = []
  node.arguments.forEach(arg => {
    let value = call(transforms, arg.type, arg, scope)
    if (!value) value = { form: 'term', term: 'null' }
    bind.push(value.form === 'line' ? toRead(value) : value)
  })
  return {
    form: 'call',
    nest,
    bind,
    link: [],
    hook: []
  }
}

function transformReturnStatement(node, scope) {
  const site = node.argument && call(transforms, node.argument.type, node.argument, scope)
  return {
    form: 'back',
    site
  }
}

function transformBinaryExpression(node, scope) {
  const name = transformName(node.operator)
  let left = call(transforms, node.left.type, node.left, { ...scope, isNested: true })
  let right = call(transforms, node.right.type, node.right, { ...scope, isNested: true })
  if (right.form === 'line') {
    right = toRead(right)
  }

  if (left.form === 'binary-call') {
    left.link.push({
      form: 'link',
      nest: toTerm(name),
      bind: [right]
    })
    return left
  } else if (left.form === 'term') {
    return {
      form: 'binary-call',
      nest: { form: 'nest', link: [left, toTerm(name)] },
      link: [],
      bind: [right]
    }
  } else if (left.form === 'line') {
    return {
      form: 'binary-call',
      nest: { form: 'nest', link: [left, toTerm(name)] },
      link: [],
      bind: [right]
    }
  } else if (left.form === 'mark' || left.form === 'text') {
    return {
      form: 'binary-call',
      nest: { form: 'nest', link: [toTerm(left.form === 'mark' ? String(left.mark) : `<${left.text}>`), toTerm(name)] },
      link: [],
      bind: [right]
    }
  } else if (left.form === 'call') {
    left.link.push({
      form: 'link',
      nest: toTerm(name),
      bind: [right]
    })
    return left
  } else {
    console.log(left)
    throw new Error
  }
}

function transformUnaryExpression(node, scope) {
  const argument = call(transforms, node.argument.type, node.argument, scope)
  const name = toTerm(transformName(node.operator, unaries))
  return createCall(name, [
    argument
  ])
}

function transformNewExpression(node, scope) {
  const bind = []
  const name = call(transforms, node.callee.type, node.callee, scope)
  node.arguments.forEach(arg => {
    const value = call(transforms, arg.type, arg, scope)
    bind.push(value)
  })
  return {
    form: 'make',
    name,
    bind
  }
}

function transformObjectExpression(node, scope) {
  const properties = []
  node.properties.forEach(p => {
    const value = call(transforms, p.type, p, scope)
    properties.push(value)
  })
  return {
    form: 'make',
    name: toTerm('look'),
    bind: properties
  }
}

function transformProperty(node, scope) {
  const key = call(transforms, node.key.type, node.key, scope)
  let value = call(transforms, node.value.type, node.value, scope)
  return createBind(key, value)
}

function transformArrayExpression(node, scope) {
  const properties = []
  node.elements.forEach(p => {
    let value = call(transforms, p.type, p, scope)
    properties.push(value)
  })

  return {
    form: 'make',
    name: toTerm('list'),
    bind: properties
  }
}

function transformSpreadElement(node, scope) {
  const argument = call(transforms, node.argument.type, node.argument, scope)
  return {
    form: 'rest',
    site: argument
  }
}

function transformFunctionDeclaration(node, scope) {
  const take = []
  const id = node.id && call(transforms, node.id.type, node.id, scope)
  const name = id ?? { form: 'term', term: `tmp${scope.index++}` }
  node.params.forEach(param => {
    const p = call(transforms, param.type, param, scope)
    take.push(p)
  })
  const zone = []
  node.body.body.forEach(bd => {
    const t = call(transforms, bd.type, bd, scope)
    if (Array.isArray(t)) {
      zone.push(...t)
    } else {
      zone.push(t)
    }
  })
  return createTask(name, take, zone)
}

function transformLabeledStatement(node, scope) {
  scope.fork.push(node.label)
  return []
}

function transformLogicalExpression(node, scope) {
  return transformBinaryExpression(node, scope)
}

function transformMemberExpression(node, scope) {
  const object = call(transforms, node.object.type, node.object, scope)
  const property = call(transforms, node.property.type, node.property, scope)
  const computed = node.computed
  const link = []
  link.push(object)
  const propLink = object.form === 'line' ? object.link : link
  if (computed) {
    if (property.form === 'nest') {
      propLink.push(property)
    } else {
      propLink.push({
        form: 'nest',
        link: [property]
      })
    }
  } else {
    propLink.push(property)
  }

  const nest = {
    form: 'line',
    link,
  }
  return nest
}

function transformAssignmentExpression(node, scope) {
  const left = call(transforms, node.left.type, node.left, scope)
  const right = call(transforms, node.right.type, node.right, scope)
  if (node.operator === '=') {
    return createSave(left, right.form === 'line' ? toRead(right) : right)
  } else {
    const name = transformName(node.operator)
    return createSave(left, createCall(toTerm(name), [toRead(left), right]))
  }
}

function transformBreakStatement(node, scope) {
  return {
    form: 'bust',
    site: {
      form: 'term',
      term: node.label
    }
  }
}

function transformThisExpression(node, scope) {
  return toTerm('self')
}

function transformUpdateExpression(node, scope) {
  const value = call(transforms, node.argument.type, node.argument, scope)
  // console.log(node.operator)
  const name = toTerm(transformName(node.operator, unaries))
  return createSave(value, createCall(name, [
    value
  ]))
}

function transformWhileStatement(node, scope) {
  const fork = scope.fork.pop()// = `fork${scope.index.value++}`

  if (node.simple) {
    const body = call(transforms, node.body.type, node.body, scope)

    return {
      form: 'walk',
      name: 'roll',
      fork,
      hook: [
        {
          form: 'hook',
          name: toTerm('step'),
          take: [],
          zone: body
        }
      ]
    }
  } else {
    const test = call(transforms, node.body.body[0].test.type, node.body.body[0].test, scope)
    const step = call(transforms, node.body.body[0].consequent.type, node.body.body[0].consequent, scope)

    return {
      form: 'walk',
      name: 'test',
      fork,
      hook: [
        {
          form: 'hook',
          name: toTerm('test'),
          take: [],
          zone: [test]
        },
        {
          form: 'hook',
          name: toTerm('step'),
          take: [],
          zone: step
        }
      ]
    }
  }
}

function transformIfStatement(node, scope) {
  const test = call(transforms, node.test.type, node.test, scope)
  const consequent = call(transforms, node.consequent.type, node.consequent, scope)
  let alternate = node.alternate && call(transforms, node.alternate.type, node.alternate, scope)
  const hook = []
  hook.push({
    name: toTerm('true'),
    form: 'hook',
    take: [],
    zone: consequent
  })
  const stemTest = {
    form: 'stem',
    name: 'test',
    test,
    hook,
  }

  if (alternate) {
    if (alternate.length === 1 && alternate[0].form === 'call') {
      const stemRoll = {
        form: 'stem',
        name: 'roll',
        test: [
          stemTest,
          {
            form: 'stem',
            name: 'fall',
            call: alternate[0],
          }
        ]
      }
      return stemRoll
    } else {
      alternate = Array.isArray(alternate) ? alternate : [alternate]
      const stemRoll = {
        form: 'stem',
        name: 'roll',
        test: [
          stemTest,
          ...alternate
        ]
      }
      return stemRoll
    }
  } else {
    return stemTest
  }
}

function transformBlockStatement(node, scope) {
  const nodes = []
  node.body.forEach(bd => {
    const x = call(transforms, bd.type, bd, scope)
    if (Array.isArray(x)) {
      nodes.push(...x)
    } else {
      nodes.push(x)
    }
  })
  return nodes
}

function transformAssignmentPattern(node, scope) {
  const left = call(transforms, node.left.type, node.left, scope)
  const right = call(transforms, node.right.type, node.right, scope)
  left.default = right
  return left
}

function transformVariableDeclarationStandalone(node, scope) {
  const list = []
  node.declarations.forEach(dec => {
    const init = dec.init && call(transforms, dec.init.type, dec.init, scope)
    const id = call(transforms, dec.id.type, dec.id, scope)
    if (init?.form === 'task') {
      init.name = id
      list.push(init)
    } else {
      list.push(createSave(id, init))
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
