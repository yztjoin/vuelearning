const Text = Symbol()
const Comment = Symbol()
const Fragment = Symbol()
function shouldSetAsProps (el, key, value) {
  // 特殊处理
  if (key === 'form' && el.tagName === 'INPUT') return false
  // 兜底
  return key in el
}
function unmount (vnode) {
  if (vnode.type === Fragment) {
    vnode.children.forEach((c) => unmount(c))
    return
  }
  const parent = vnode.el.parentNode
  if (parent) {
    parent.removeChild(vnode.el)
  }
}
function createRenderer (options) {
  // 通过options得到操作DOM的API
  const { createElement, insert, setElementText, patchProps } = options
  // 在这个作用域内定义的函数都可以访问哪些API
  function mountElement (vnode, container) {
    // 建立虚拟dom与真实dom的联系
    const el = (vnode.el = createElement(vnode.type))
    if (typeof vnode.children === 'string') {
      setElementText(el, vnode.children)
    } else if (Array.isArray(vnode.children)) {
      vnode.children.forEach((child) => {
        patch(null, child, el)
      })
    }
    if (vnode.props) {
      for (const key in vnode.props) {
        //正确的设置元素属性
        patchProps(el, key, null, vnode.props[key])
      }
    }
    insert(el, container)
  }
  // patch函数就是查找旧dom与新dom的不同然后找到不同针对其重新渲染
  function patch (n1, n2, container) {
    if (n1 && n1.type !== n2.type) {
      // 如果旧 vnode的类型不同，则直接将旧vnode卸载
      unmount(n1)
      n1 = null
    }
    const { type } = n2
    if (typeof type === 'string') {
      if (!n1) {
        mountElement(n2, container)
      } else {
        // 更新
        patchElement(n1, n2)
      }
    } else if (type === Text) {
      // 如果新vnode的类型是Text，则说明vnode描述的是文本节点
      if (!n1) {
        const el = (n2.el = createText(n2.children))
        insert(el, container)
      } else {
        // 如果旧vnode存在，只需要使用新文本节点的文本内容更新旧文本节点即可
        const el = (n2.el = n1.el)
        if (n2.children !== n1.children) {
          setElementText(el, n2.children)
        }
      }
    } else if (type === Fragment) {
      if (!n1) {
        n2.children.forEach((c) => patch(null, c, container))
      } else {
        patchChildren(n1, n2, container)
      }
    } else if (typeof type === 'object') {
      // 如果 n2.type 的值是对象 则表示是组件
    } else if (type === 'xxx') {
      // 处理其他类型
    }
  }
  function patchElement (n1, n2) {
    const el = (n2.el = n1.el)
    const oldProps = n1.props
    const newProps = n2.props
    for (const key in newProps) {
      if (newProps[key] !== oldProps[key]) {
        patchProps(el, key, oldProps[key], newProps[key])
      }
    }
    for (const key in oldProps) {
      if (!(key in newProps)) {
        patchProps(el, key, oldProps[key], null)
      }
    }
    patchChildren(n1, n2, el)
  }
  function patchChildren (n1, n2, container) {
    if (typeof n2.children === 'string') {
      if (Array.isArray(n1.children)) {
        n1.children.forEach((c) => unmount(c))
      }
      setElementText(container, n2.children)
    } else if (Array.isArray(n2.children)) {
      // // 说明新子节点是一组子节点
      // // 判断旧子节点是否也是一组子节点
      // if (Array.isArray(n1.children)) {
      //   // n1和n2都是一组子节点，设计核心的Diff算法
      //   n1.children.forEach((c) => unmount(c))
      //   n2.children.forEach((c) => patch(null, c, container))
      // } else {
      //   setElementText(container, '')
      //   n2.children.forEach((c) => patch(null, c, container))
      // }
      const oldChildren = n1.children
      const newChildren = n2.children
      // 遍历新的children
      for (let i = 0; i < newChildren.length; i++) {
        const newVNode = newChildren[i]
        for (let j = 0; j < oldChildren.length; j++) {
          const oldVNode = oldChildren[j]
          // 如果找到了具有相同key值的两个节点，说明可以复用，但仍然需要调用patch函数更新
          if (newVNode.key === oldVNode.key) {
            patch(oldVNode, newVNode, container)
            break
          }
        }
      }

      // 旧的一组子节点的长度
      const oldLen = oldChildren.length
      const newLen = newChildren.length
      // 如果新的一组子节点更长，则说明有新子节点需要挂载，否则说明有旧子节点需要卸载
      const commonLength = Math.min(oldLen, newLen)
      for (let i = 0; i < commonLength; i++) {
        patch(oldChildren[i], newChildren[i])
      }
      if (newLen > oldLen) {
        for (let i = commonLength; i < newLen; i++) {
          patch(null, newChildren[i], container)
        }
      } else if (oldLen > newLen) {
        for (let i = commonLength; i < oldLen; i++) {
          unmount(oldChildren[i])
        }
      }
    } else {
      // 新子节点不存在
      if (Array.isArray(n1.children)) {
        n1.children.forEach((c) => unmount(c))
      } else if (typeof n1.children === 'string') {
        setElementText(container, '')
      }
      // 如果也没有旧节点则什么都不做
    }
  }
  function render (vnode, container) {
    console.log(vnode, container)
    if (vnode) {
      // patch函数就是查找旧dom与新dom的不同然后找到不同针对其重新渲染
      // 新vnode存在，将其与旧vnode一起传递给patch函数，进行打补丁
      patch(container._vnode, vnode, container)
    } else {
      if (container._vnode) {
        unmount(container._vnode)
      }
    }
    container._vnode = vnode
  }

  function hydrate (vnode, container) { }
  return {
    render,
    hydrate,
  }
}

const renderer = createRenderer({
  createElement (tag) {
    return document.createElement(tag)
  },
  setElementText (el, text) {
    el.textContent = text
  },
  insert (el, parent, anchor = null) {
    parent.insertBefore(el, anchor)
  },
  // 将属性设置相关操作封装到patchProps函数中，并作为渲染器选项传递
  patchProps (el, key, prevValue, nextValue) {
    if (/^on/.test(key)) {
      // const name = key.slice(2).toLowerCase()
      // prevValue && el.removeEventListener(name, prevValue)
      // el.addEventListener(name, nextValue)

      // 获取为该匀速伪造的事件处理函数 invoker
      let invokers = el._vel || (el._vel = {})
      let invoker = invokers[key]
      const name = key.slice(2).toLowerCase()
      if (nextValue) {
        if (!invoker) {
          // 如果没有invoker, 则将一个伪造的invoker缓存到el._vel
          invoker = el._vel[key] = (e) => {
            // e.timeStamp 是事件发生的时间
            // 如果事件发生的事件早于事件处理函数绑定的事件，则不执行事件处理函数
            if (e.timeStamp < invoker.attached) return
            // 如果 invoker.value 是数组，则遍历它并诸葛调用书简处理函数
            if (Array.isArray(invoker.value)) {
              invoker.value.forEach((fn) => fn(e))
            } else {
              invoker.value(e)
            }
          }
          // 将真正的事件处理函数赋值给 invoker.value
          invoker.value = nextValue
          // 添加invoker.attached属性，存储事件处理函数被绑定的事件
          invoker.attached = performance.now()
          // 绑定invoker作为事件处理函数
          el.addEventListener(name, invoker)
        } else {
          invoker.value = nextValue
        }
      } else if (invoker) {
        el.removeEventListener(name, invoker)
      }
    } else if (key === 'class') {
      // 在对比className和setAttribute和el.classList中className性能最优
      el.className = nextValue || ''
    } else if (shouldSetAsProps(el, key, nextValue)) {
      const type = typeof el[key]
      if (type === 'boolean' && nextValue === '') {
        el[key] = true
      } else {
        el[key] = nextValue
      }
    } else {
      el.setAtribute(key, nextValue)
    }
  },
  createText (text) {
    return document.createTextNode(text)
  },
  setText (el, text) {
    el.nodeValue = text
  },
})
function normalizeClass (classValue) {
  // 字符串
  if (typeof classValue === 'string') return classValue
  let resultClassSet = new Set()
  // 数组和对象情况
  if (Array.isArray(classValue)) {
    for (const value of classValue) {
      if (typeof value === 'string') resultClassSet.add(value)
      else {
        // 对象
        handleObject(resultClassSet, value)
      }
    }
  } else {
    // 对象
    handleObject(resultClassSet, classValue)
  }
  return Array.from(resultClassSet).join(' ').trim()
}
// normalizeClass里处理Object.
function handleObject (set, obj) {
  for (const key in obj) {
    if (obj[key]) set.add(key) // 如果对象的值为true, set里把键(className)加进去
  }
}
