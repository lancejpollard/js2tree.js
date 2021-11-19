
module.exports = print

const printers = {
  host: printHost,
  call: printCall,
  task: printTask,
}

function print(nodes) {
  const text = []
  nodes.forEach(node => {
    text.push(...call(printers, node.form, node))
  })
  return text.join('\n')
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
    text.push(`host ${node.name}`)
  } else {
    if (sift.length > 1) {
      text.push(`host ${node.name}`)
      sift.forEach(line => {
        text.push(`  ${line}`)
      })
    } else {
      text.push(`host ${node.name}, ${sift}`)
    }
  }
  return text
}

function printSift(node) {
  if (node.form === 'size') {
    return [`size ${node.size}`]
  } else if (node.form === 'text') {
    return [`text <${node.text}>`]
  } else {
    return call(printers, node.form, node)
  }
}

function printCall(node) {
  const text = []
  text.push(`call ${node.name}`)
  node.bind.forEach(b => {
    printBind(b).forEach(line => {
      text.push(`  ${line}`)
    })
  })
  node.zone.forEach(z => {
    if (z.form === 'call-save') {
      text.push(`  save ${z.name}`)
    }
  })
  return text
}

function printBind(node) {
  const text = []
  text.push(`bind ${node.name}`)
  return text
}

function call(obj, method, ...args) {
  if (!obj.hasOwnProperty(method)) {
    throw new Error(`Missing method ${method}`)
  }

  return obj[method](...args)
}
