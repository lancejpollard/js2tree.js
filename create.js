
module.exports = {
  createTask,
  createSave,
  createBase,
  createTerm,
  createCall,
  createForm,
  createMark,
  createText,
  createBind,
  createWalk,
  createCallSave,
}

function createForm(name, base) {
  return {
    form: 'form',
    name,
    base
  }
}

function createTask(name, take = [], zone = []) {
  return {
    form: 'task',
    name,
    take,
    zone
  }
}

function createTerm(value) {
  return {
    form: 'term',
    term: String(value)
  }
}

function createSave(nest, bond, form) {
  return {
    form: 'save',
    nest,
    bond,
    base_form: form
  }
}

function createBase(name, { miss, form } = {}) {
  return {
    form: 'base',
    name,
    miss,
    base_form: form
  }
}

function createWalk(name, bind = [], hook = [], fork = null) {
  return {
    form: 'walk',
    name,
    bind,
    hook,
    fork
  }
}

function createCall(nest, bind = [], hook = [], link = [], zone = []) {
  return {
    form: 'call',
    nest,
    bind,
    hook,
    link,
    zone
  }
}

function createMark(mark) {
  return {
    form: 'mark',
    mark
  }
}

function createNest(text) {
  return {
    form: 'nest',
    text
  }
}

function createText(text) {
  return {
    form: 'text',
    text
  }
}

function createBind(name, sift) {
  if (!sift) {
    return {
      form: 'bind',
      name: null,
      sift: name
    }
  } else {
    return {
      form: 'bind',
      name,
      sift
    }
  }
}

function createCallSave(name) {
  return {
    form: 'call-save',
    name
  }
}
