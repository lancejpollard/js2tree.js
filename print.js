
module.exports = print

const printers = {
  host: printHost,
  call: printCall,
  task: printTask,
  link: printLink,
  site: printSite,
  turn: printTurn,
  term: printTerm,
  make: printMake,
  rest: printRest,
  save: printSave,
  size: printSize,
}

function printSize(node) {
  return [`size ${node.size}`]
}

function printTerm(node) {
  return [node.term]
}

function print(nodes) {
  const text = []
  nodes.forEach(node => {
    text.push(...call(printers, node.form, node))
  })
  return text.join('\n')
}

function printSave(node) {
  const left = call(printers, node.left.form, node.left)
  const right = call(printers, node.right.form, node.right)
  const text = []
  if (right.length > 1) {
    text.push(`save ${left.join('')}`)
    right.forEach(line => {
      text.push(`  ${line}`)
    })
  } else {
    text.push(`save ${left.join('')}, ${right.join('')}`)
  }
  return text
}

function printRest(node) {
  const text = []
  text.push(`rest ${printName(node.site)}`)
  return text
}

function printMake(node) {
  const text = []
  text.push(`make ${printName(node.name)}`)
  node.bind.forEach(b => {
    printBind(b).forEach(line => {
      text.push(`  ${line}`)
    })
  })
  return text
}

function printTurn(node) {
  const text = []
  if (node.site) {
    text.push(`turn seed, link ${printName(node.site)}`)
  } else {
    text.push(`turn seed`)
  }
  return text
}

function printSite(node) {
  return [printName(node)]
}

function printLink(node) {
  if (node.site.form === 'term') {
    return [node.site.term]
  } else {
    return [node.term]
  }
}

function printTask(node) {
  const text = []
  text.push(`task ${node.name}`)
  node.base.forEach(b => {
    printBase(b).forEach(line => {
      text.push(`  ${line}`)
    })
  })
  node.zone.forEach(z => {
    call(printers, z.form, z).forEach(line => {
      text.push(`  ${line}`)
    })
  })
  return text
}

function printBase(node) {
  const text = []
  const sift = node.sift ? printSift(node.sift) : undefined
  if (sift == null) {
    text.push(`base ${node.name}`)
  } else {
    if (sift.length > 1) {
      text.push(`base ${node.name}`)
      sift.forEach(line => {
        text.push(`  ${line}`)
      })
    } else {
      text.push(`base ${node.name}, ${sift}`)
    }
  }
  return text
}

function printHost(node) {
  const text = []
  const sift = node.sift ? printSift(node.sift) : undefined
  if (sift == null) {
    text.push(`save ${printName(node.name)}`)
  } else {
    if (sift.length > 1) {
      text.push(`save ${printName(node.name)}`)
      sift.forEach(line => {
        text.push(`  ${line}`)
      })
    } else {
      text.push(`save ${printName(node.name)}, ${sift}`)
    }
  }
  return text
}

function printSift(node) {
  if (node.form === 'size') {
    return [`size ${node.size}`]
  } else if (node.form === 'text') {
    return [`text <${node.text}>`]
  } else if (node.form === 'link') {
    return [`link ${printName(node.site)}`]
  } else if (node.form === 'rest') {
    return [`rest ${printName(node.site)}`]
  } else {
    return call(printers, node.form, node)
  }
}

function printCall(node) {
  const text = []
  text.push(`call ${printName(node.name)}`)
  node.bind.forEach(b => {
    printBind(b).forEach(line => {
      text.push(`  ${line}`)
    })
  })
  node.zone.forEach(z => {
    if (z.form === 'call-save') {
      text.push(`  save ${printName(z.name)}`)
    } else if (z.form === 'call-turn') {
      text.push(`  turn ${z.term}`)
    }
  })
  Object.keys(node.hook).forEach(name => {
    const hook = node.hook[name]
    printHook(name, hook).forEach(line => {
      text.push(`  ${line}`)
    })
  })
  return text
}

function printHook(name, hook) {
  const text = []
  text.push(`hook ${name}`)
  hook.base.forEach(b => {
    printBase(b).forEach(line => {
      text.push(`  ${line}`)
    })
  })
  hook.zone.forEach(z => {
    call(printers, z.form, z).forEach(line => {
      text.push(`  ${line}`)
    })
  })
  return text
}

function printName(node) {
  if (node.form === 'site') {
    const host = printName(node.host)
    const link = printName(node.link)
    const bond = node.bond
    if (bond) {
      return `${host}[${link}]`
    } else {
      return `${host}/${link}`
    }
  } else if (node.form === 'link') {
    return printLink(node)
  } else if (node.form === 'term') {
    return node.term
  } else if (node.form === 'size') {
    return `${node.size}`
  }
}

function printBind(node) {
  const text = []
  const sift = node.sift ? printSift(node.sift) : []
  if (sift.length > 1) {
    if (node.name) {
      text.push(`bind ${printName(node.name)}`)
    } else {
      text.push(`bind`)
    }
    sift.forEach(line => {
      text.push(`  ${line}`)
    })
  } else {
    if (node.name) {
      text.push(`bind ${printName(node.name)}, ${sift.join('')}`)
    } else {
      text.push(`bind ${sift.join('')}`)
    }
  }
  return text
}

function call(obj, method, ...args) {
  if (!obj.hasOwnProperty(method)) {
    throw new Error(`Missing method ${method}`)
  }

  return obj[method](...args)
}
