
module.exports = {
  createTask,
  createHostZone,
  createBase,
  createCall,
  createForm,
  createSave,
  createSize,
  createText,
  createBind,
  createCallSave,
}

function createSave(left, right) {
  return {
    form: 'save',
    left,
    right
  }
}

function createForm(name, base) {
  return {
    form: 'form',
    name,
    base
  }
}

function createTask(name, base = [], zone = []) {
  return {
    form: 'task',
    name,
    base,
    zone
  }
}

function createHostZone(name, sift, form) {
  return {
    form: 'host',
    name,
    sift,
    base_form: form
  }
}

function createBase(name, form) {
  return {
    form: 'base',
    name,
    base_form: form
  }
}

function createCall(name, bind = [], hook = [], zone = []) {
  return {
    form: 'call',
    name,
    bind,
    hook,
    zone
  }
}

function createSize(size) {
  return {
    form: 'size',
    size
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
