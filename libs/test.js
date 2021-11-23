
const fs = require('fs')
const pathResolver = require('path')
const HEAD = fs.readFileSync('./make/head/index.js', 'utf-8')

class Scope {
  constructor() {
    this.variableIndex = 1
    this.names = {}
    this.links = {}
  }

  createName() {
    const name = `x${this.variableIndex++}`
    this.names[name] = false
    return name
  }
}

module.exports = make

function makeDockCallTest(call, loadState) {
  const ast = []
  const test = call.bind[0]
  const make = call.bind[1]
  const ifStatement = {
    type: 'if-statement',
    // condition:
  }
  ast.push(`if (${makeNest(test.sift.nest, loadState)}()) {`)
  ast.push(`  return ${makeNest(make.sift.nest, loadState)}()`)
  ast.push(`}`)
  return ast.join('\n')
}

function makeFunctionCall() {

}

function makeIfStatement(test, match, fault) {
  return {
    type: 'if-statement',
    test,
    match,
    fault
  }
}
