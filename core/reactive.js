const bucket = new WeakMap()
let activeEffect
const effectStack = [] // 新增
// 使用Promise.resolve创建一个promis实例，添加到微任务列队
const p = Promise.resolve()
// 一个标志代表是否正在刷新队列
let isFlushing = false
// 创建唯一key 用于数组
export const ITERATE_KEY = Symbol()
export const Map_KEY_ITERATE_KEY = Symbol()
// 定义一个任务列队
export const jobQueue = new Set()
const arrayInstrumentations = {}

// 标记变量 是否追踪 默认值为true 允许追踪
let shouldTrack = true
// 重写数组的push方法
;['push', 'pop', 'shift', 'unshift', 'splice'].forEach((method) => {
  // 取得原始 push 方法
  const originMethod = Array.prototype[method]
  // 重写
  arrayInstrumentations[method] = function (...args) {
    // 在调用方法之前禁止追踪
    shouldTrack = false
    let res = originMethod.apply(this, args)
    // 调用方法之后恢复行为
    shouldTrack = true
    return res
  }
})
;['includes', 'indexOf', 'lastIndexOf'].forEach((method) => {
  const originMethod = Array.prototype[method]
  arrayInstrumentations[method] = function (...args) {
    // this 是代理对象 先在代理对象中查找，将记过储存到res中
    let res = originMethod.apply(this, args)
    if (res === false) {
      // res 为false 说明没有找到，通过this.raw拿到原始数组，再去查找
      res = originMethod.apply(this.raw, args)
    }
    return res
  }
})
// 定义一个Map实例，储存原始对象到代理对象的映射
const reactiveMap = new Map()
function traverse(value, seen = new Set()) {
  // 如果读取的数据时原始值，或者已经被读取过了，那么什么都不做
  if (typeof value !== 'object' || value === null || seen.has(value)) return
  // 暂时不考虑数组等其他结构
  // 将数据添加到seen中 代表遍历的读取过了
  seen.add(value)
  for (const k in value) {
    traverse(value[k], seen)
  }
  return value
}

export function watch(source, cb, opations = {}) {
  let getter
  // 如果source是函数 说明用户传递的是getter 可以直接把source赋值给getter
  if (typeof source === 'function') {
    getter = source
  } else {
    getter = () => traverse(source)
  }
  // 定义旧值与新值
  let oldValue, newValue
  let cleanup
  function onInvalidate(fn) {
    cleanup = fn
  }
  const job = () => {
    newValue = effectFn()
    if (cleanup) {
      cleanup()
    }
    cb(newValue, oldValue, onInvalidate)
    // 更新旧值
    oldValue = newValue
  }
  const effectFn = effect(
    () => {
      return getter()
    },
    {
      lazy: true,
      scheduler: () => {
        if (opations.flush === 'post') {
          let p = Promise.resolve()
          p.then(() => {
            job()
          })
        } else {
          job()
        }
      },
    }
  )
  if (opations.immediate) {
    job()
  } else {
    oldValue = effectFn()
  }
}
export function flushJob() {
  // 如果列队正在刷新则什么都不做
  if (isFlushing) return
  // 设置为true 代表正在刷新
  isFlushing = true
  // 在微任务列队中刷新jobQueue队列
  p.then(() => {
    jobQueue.forEach((job) => job())
  }).finally(() => {
    isFlushing = false
  })
}
export function computed(getter) {
  // 增加diry 脏值检查 用于判断是否更新数据
  let dirty = true
  let value
  // 把getter作为副作用函数，创建一个lazy的effect
  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      dirty = true
      trigger(obj, 'value')
    },
  })
  const obj = {
    // 当读取的时候才执行effectFn
    get value() {
      if (dirty) {
        value = effectFn()
        dirty = false
        track(obj, 'value')
      }
      return value
    },
  }
  return obj
}
export function effect(fn, opations = {}) {
  const effectFn = () => {
    cleanup(effectFn)
    // 将副作用函数赋值给activeEffect
    activeEffect = effectFn
    // 在调用副作用函数之前将当前作用函数压入栈中

    effectStack.push(effectFn)
    // fn执行的结果保存到res
    const res = fn()
    // 在当前副作用函数执行完毕后，将当前副作用函数出栈，并把还原为之前的值
    effectStack.pop() // 新增
    activeEffect = effectStack[effectStack.length - 1] // 新增
    return res
  }
  // 将options挂载到effectFn上
  effectFn.opations = opations
  // 用来存储所有与该副作用函数相关的集合
  effectFn.deps = []
  // 当配置属性lazy为false的情况下才立即执行函数
  if (!opations.lazy) {
    // 执行副作用函数
    effectFn()
  }
  return effectFn
}
function cleanup(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i]
    deps.delete(effectFn)
  }
  effectFn.deps.length = 0
}

export function track(target, key) {
  if (!activeEffect || !shouldTrack) return
  // 取出‘捅’中的该对象副作用数据depsMap 是个Map对象
  let depsMap = bucket.get(target)
  // 如果没有则初始化一个Map
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()))
  }
  // 取出该对象副作用的数据中key，
  // 用来判断该对象的key改变是否需要更新数据，也就是有没有副作用函数
  let deps = depsMap.get(key)
  // 没有初始化一个
  if (!deps) {
    depsMap.set(key, (deps = new Set()))
  }
  // 副作用函数入栈
  deps.add(activeEffect)
  // deps就是一个与当前副作用函数存在联系依赖集合
  activeEffect.deps.push(deps)
}
// 数据更新执行
export function trigger(target, key, type, newVal) {
  let depsMap = bucket.get(target)
  if (!depsMap) return
  const effects = depsMap.get(key)
  // 取出与 ITERATE_KEY 相关联的副作用函数
  const iterateEffects = depsMap.get(ITERATE_KEY)
  const effectsToRun = new Set()
  effects &&
    effects.forEach((effectFn) => {
      // 如果trigger触发执行的副作用函数与当前正在执行的副作用函数相同，则不触发执行
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  if (
    (type === 'ADD' || type === 'DELETE') &&
    Object.prototype.toString.call(target) === '[object Map]'
  ) {
    const iterateEffects = depsMap.get(Map_KEY_ITERATE_KEY)
    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn)
        }
      })
  }
  // 将与 ITERATE_KEY 相关的副作用函数也添加到effectsToRun
  if (
    type === 'ADD' ||
    type === 'DELETE' ||
    (type === 'SET' &&
      Object.prototype.toString.call(target) === '[object Map]')
  ) {
    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn)
        }
      })
  }
  // 当操作类型时ADD并且是数组时，取出执行与length属性相关的副作用函数
  if (type === 'ADD' && Array.isArray(target)) {
    const lengthEffects = depsMap.get('length')
    lengthEffects &&
      lengthEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn)
        }
      })
  }
  //
  if (Array.isArray(target) && key === 'length') {
    depsMap.forEach((effects, key) => {
      if (key > newVal) {
        effects.forEach((effectFn) => {
          if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn)
          }
        })
      }
    })
  }
  effectsToRun.forEach((effectFn) => {
    if (effectFn.opations.scheduler) {
      effectFn.opations.scheduler(effectFn)
    } else {
      effectFn()
    }
  })
}
function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      // 如果没有副作用影响 直接返回
      if (key === 'raw') return target

      // 如果操作的目标对象是数组，并且key存在于arrayInstrumentations上
      // 那么返回定义在arrayInstrumentations上的值
      if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(arrayInstrumentations, key, reactive)
      }
      // 如果是只读的返回警告信息
      // if (!activeEffect) return target[key]
      if (!isReadonly && typeof key !== 'symbol') {
        track(target, key)
      }
      const res = Reflect.get(target, key, receiver)
      if (isShallow) {
        return res
      }
      if (typeof res === 'object' && res !== null) {
        return isReadonly ? readonly(res) : reactive(res)
      }
      return res
    },
    set(target, key, newVal, receiver) {
      // 如果是只读的返回警告信息
      if (isReadonly) {
        console.warn(`属性${key}是只读的`)
        return true
      }
      // 获取旧值
      const oldValue = target[key]
      const type = Array.isArray(target)
        ? Number(key) < target.length
          ? 'SET'
          : 'ADD'
        : Object.prototype.hasOwnProperty(target, key)
        ? 'SET'
        : 'ADD'
      const res = Reflect.set(target, key, newVal, receiver)
      // 相等旧说明receiver就是 target的代理对象
      if (target === receiver.raw) {
        // 比较新值和旧值是否发生改变
        if (
          (newVal === newVal || oldValue === oldValue) &&
          oldValue !== newVal
        ) {
          trigger(target, key, type, newVal)
        }
      }

      return res
    },
    has(target, key) {
      track(target, key)
      return Reflect.has(target, key)
    },
    ownKeys(target) {
      // 绑定为ITERATE_KEY作为追踪的key
      track(target, Array.isArray(target) ? 'length' : ITERATE_KEY)
      return Reflect.ownKeys(target)
    },
    deleteProperty(target, key) {
      // 如果是只读的返回警告信息
      if (isReadonly) {
        console.warn(`属性${key}是只读的`)
        return true
      }
      // 检查操作是否属于自己的值
      const hadKey = Object.prototype.hasOwnProperty.call(target, key)
      // 使用Reflect.deleteProperty 完场删除操作
      const res = Reflect.deleteProperty(target, key)
      if (res && hadKey) {
        trigger(target, key, 'DELETE')
      }
      return res
    },
  })
}
// 封装一个ref函数
function ref(val) {
  const wrapper = {
    value: val,
  }
  // 使用Object.defineProperty在wrapper对象上定义一个不可枚举的属性值__v_isRef
  // 并且值为true 用于区分原始值包裹对象和非原始值包裹对象
  Object.defineProperty(wrapper, '__v_isRef', {
    value: true,
  })
  return reactive(wrapper)
}
function toRef(obj, key) {
  const wrapper = {
    get value() {
      return obj[key]
    },
    set value(val) {
      obj[key] = val
    },
  }
  Object.defineProperty(wrapper, '__v_isRef', {
    value: true,
  })
  return wrapper
}
function toRefs(obj) {
  const ret = {}
  // 使用for..in循环遍历对象
  for (const key in obj) {
    // 逐个调用toRef完成转换
    ret[key] = toRef(obj, key)
  }
  return ret
}
// 在setup函数返回的数据会传递给proxyRefs函数进行处理
// 因此在模板中调用的时候不用使用value
function proxyRefs(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver)
      return value['__v_isRef'] ? value.value : value
    },
    set(target, key, newValue, receiver) {
      // 通过target读取真实值
      const value = target[key]
      if (value.__v_isRef) {
        value.value = newValue
        return true
      }
      return Reflect.set(target, key, newValue, receiver)
    },
  })
}
export function reactive(obj) {
  // 通过reactiveMap查找之前创建的代理对象 如果有的话直接返回
  const existionProxy = reactiveMap.get(obj)
  if (existionProxy) return existionProxy
  // 否则 创建新的代理对象
  const proxy = createReactive(obj)
  reactiveMap.set(obj, proxy)
  return proxy
}
export function shallowReactive(obj) {
  return createReactive(obj, true)
}
export function readonly(obj) {
  return createReactive(obj, false, true)
}
export function shallowReadonly(obj) {
  return createReactive(obj, true, true)
}
