const vnode2 = {
  type: 'p',
  children: 'hello',
  props: {
    class: 'box',
  },
}
const { reactive, effect } = myVue

const vnode = {
  type: 'div',
  props: {
    id: 'foo',
    onClick: [
      () => {
        console.log('触发1')
      },
      () => {
        console.log('触发2')
      },
    ],
  },
  children: [vnode2],
  // 序列化calss 结果等于 class:'foo bar baz'
}

const oldVnode = {
  type: 'div',
  children: [
    { type: 'p', children: '1', key: 1 },
    { type: 'p', children: '2', key: 2 },
    { type: 'p', children: '3', key: 3 },
  ],
}
const newVnode = {
  type: 'div',
  children: [
    { type: 'p', children: '3', key: 3 },
    { type: 'p', children: '1', key: 1 },
    { type: 'p', children: '2', key: 2 },
  ],
}
renderer.render(oldVnode, document.querySelector('#app'))
setTimeout(() => {
  renderer.render(newVnode, document.querySelector('#app'))
}, 3000)
