
module.exports = print

const printers = {
  save: printSave,
  nest: printNest,
  call: printCall,
  mark: printMark,
  text: printText,
  term: printTerm,
  'binary-call': printBinaryCall,
  link: printLink,
  task: printTask,
  back: printBack,
  stem: printStem,
  hook: printHook,
  walk: printWalk,
  bust: printBust,
  line: printLine,
  read: printRead,
  make: printMake,
  bind: printBind,
  rest: printRest,
}

function printRest(node) {
  const text = []
  const nest = printNest(node.site)
  text.push(`read ${nest}, rest true`)
  return text
}

function printBind(node) {
  const text = []
  const lines = printBond(node.sift)

  if (lines.length === 1) {
    text.push(`bind ${node.name.term}, ${lines[0]}`)
  } else {
    text.push(`bind ${node.name.term}`)
    lines.forEach(line => {
      text.push(`  ${line}`)
    })
  }
  return text
}

function printBond(node) {
  switch (node.form) {
    case 'term': return [`read ${node.term}`]
    case 'text': return [`text <${node.text}>`]
    case 'mark': return [`mark ${node.mark}`]
    default: return call(printers, node.form, node)
  }
}

function printMake(node) {
  const text = []
  text.push(`make ${printNest(node.name).join('')}`)
  node.bind.forEach(bind => {
    call(printers, bind.form, bind).forEach(line => {
      text.push(`  ${line}`)
    })
  })
  return text
}

function printRead(node) {
  return [`read ${printLine(node.line)}`]
}

function printLine(node) {
  return printNest(node)
}

function printBust(node) {
  return [`bust ${node.site.term ?? 'walk'}`]
}

function printWalk(node) {
  switch (node.name) {
    case 'test': return printWalkTest(node)
    case 'roll': return printWalkRoll(node)
  }
}

function printWalkTest(node) {
  const text = []
  text.push(`walk test`)
  node.hook.forEach(hook => {
    call(printers, hook.form, hook).forEach(line => {
      text.push(`  ${line}`)
    })
  })
  return text
}

function printWalkRoll(node) {
  const text = []
  text.push(`walk roll`)
  node.hook.forEach(hook => {
    call(printers, hook.form, hook).forEach(line => {
      text.push(`  ${line}`)
    })
  })
  return text
}

function printHook(node) {
  const text = []
  text.push(`hook ${node.name.term}`)
  node.take.forEach(take => {
    text.push(`  take ${take.term}`)
  })
  node.zone.forEach(zone => {
    call(printers, zone.form, zone).forEach(line => {
      text.push(`  ${line}`)
    })
  })
  return text
}

function printStem(node) {
  switch (node.name) {
    case 'test': return printStemTest(node)
    case 'roll': return printStemRoll(node)
    case 'fall': return printStemFall(node)
  }
}

function printStemFall(node) {
  const text = []
  text.push(`stem fall`)
  call(printers, node.call.form, node.call).forEach(line => {
    text.push(`  ${line}`)
  })
  return text
}

function printStemRoll(node) {
  const text = []
  text.push(`stem roll`)
  node.test.forEach(test => {
    call(printers, test.form, test).forEach(line => {
      text.push(`  ${line}`)
    })
  })
  return text
}

function printStemTest(node) {
  const text = []
  const test = call(printers, node.test.form, node.test)
  if (test.length === 1) {
    text.push(`stem test, ${test[0]}`)
  } else {
    text.push(`stem test`)
    test.forEach(line => {
      text.push(`  ${line}`)
    })
  }
  node.hook.forEach(hook => {
    call(printers, hook.form, hook).forEach(line => {
      text.push(`  ${line}`)
    })
  })
  return text
}

function printBack(node) {
  const text = []
  const lines = node.site ? call(printers, node.site.form, node.site) : []
  if (lines.length === 1) {
    text.push(`back seed, ${lines[0]}`)
  } else {
    text.push(`back seed`)
    lines.forEach(line => {
      text.push(`  ${line}`)
    })
  }
  return text
}

function printTask(node) {
  const text = []
  text.push(`task ${node.name.term}`)
  node.take.forEach(take => {
    // if (take.default) {

    // }
    text.push(`  take ${take.term}`)
  })
  node.zone.forEach(zone => {
    call(printers, zone.form, zone).forEach(line => {
      text.push(`  ${line}`)
    })
  })
  text.push('')
  return text
}

function printLink(node) {
  const text = []
  const nest = printNest(node.nest).join('')
  const lines = []
  node.bind.forEach(bind => {
    call(printers, bind.form, bind).forEach(line => {
      lines.push(`${line}`)
    })
  })

  if (lines.length === 1) {
    text.push(`link ${nest}, ${lines[0]}`)
  } else {
    text.push(`link ${nest}`)
    lines.forEach(line => {
      text.push(`  ${line}`)
    })
  }
  return text
}

function printBinaryCall(node) {
  const text = []
  const nest = printNest(node.nest).join('')
  const lines1 = []
  node.bind.forEach(bind => {
    call(printers, bind.form, bind).forEach(line => {
      lines1.push(`${line}`)
    })
  })
  if (lines1.length === 1) {
    text.push(`call ${nest}, ${lines1[0]}`)
  } else {
    text.push(`call ${nest}`)
    lines1.forEach(line => {
      text.push(`  ${line}`)
    })
  }
  node.link.forEach(link => {
    call(printers, link.form, link).forEach(line => {
      text.push(`  ${line}`)
    })
  })
  return text
}

function printMark(node) {
  return [`mark ${node.mark}`]
}

function printText(node) {
  return [`text <${node.text}>`]
}

function printTerm(node) {
  return [`read ${node.term}`]
}

function printCall(node) {
  const text = []
  const nest = printNest(node.nest).join('')
  const lines = []
  node.bind.forEach(bind => {
    call(printers, bind.form, bind).forEach(line => {
      lines.push(`${line}`)
    })
  })
  if (lines.length === 1) {
    text.push(`call ${nest}, ${lines[0]}`)
  } else {
    text.push(`call ${nest}`)
    lines.forEach(line => {
      text.push(`  ${line}`)
    })
  }

  node.link.forEach(link => {
    call(printers, link.form, link).forEach(line => {
      text.push(`  ${line}`)
    })
  })
  return text
}

function printSave(node) {
  const text = []
  const nest = printNest(node.nest).join('')
  const lines = []
  if (node.bond) {
    call(printers, node.bond.form, node.bond).forEach(line => {
      lines.push(line)
    })
  }
  if (lines.length === 1) {
    text.push(`save ${nest}, ${lines[0]}`)
  } else {
    text.push(`save ${nest}`)
    lines.forEach(line => {
      text.push(`  ${line}`)
    })
  }
  return text
}

function print(nodes) {
  const text = []
  // console.log(JSON.stringify(nodes, null, 2))
  nodes.forEach(node => {
    text.push(...call(printers, node.form, node))
  })
  return text.join('\n')
}

function printNest(node) {
  switch (node.form) {
    case 'term': return [node.term]
    default:
      const text = []
      node.link.forEach((x, i) => {
        const link = printNestLink(x)
        if (i > 0) {
          if (x.form === 'nest') {
            text.push(`${link}`)
          } else {
            text.push(`/${link}`)
          }
        } else {
          text.push(`${link}`)
        }
      })
      return [text.join('')]
  }
}

function printNestLink(x) {
  switch (x.form) {
    case 'term': return x.term
    case 'text': return `<${x.text}>`
    case 'mark': return `${x.mark}`
    case 'nest': return `[${call(printers, x.form, x).join('')}]`
    default: return call(printers, x.form, x)
  }
}

function call(obj, method, ...args) {
  if (!obj.hasOwnProperty(method)) {
    throw new Error(`Missing method ${method}`)
  }

  return obj[method](...args)
}
