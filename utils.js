let miaoMiao = {
  _name: '疫苗',
  get name() {
    return this._name
  },
}
let miaoXy = new Proxy(miaoMiao, {
  get(target, prop, receiver) {
    console.log(target,prop)
    return Reflect.get(target,prop,receiver)
  },
  set(target, prop, newValue,receiver){
    console.log('++++++++++',target, prop, newValue,receiver)
    Reflect.set(target,prop,newValue,receiver)
    return true
  }
})
let kexingMiao = {
  __proto__: miaoXy,
  _name: '科兴疫苗',
}
console.log(kexingMiao.name)
kexingMiao._name = "9999"
console.log(kexingMiao)
console.log(miaoXy)
console.log(kexingMiao.name)
