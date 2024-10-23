const config = {
  input: './core/index.js',
  output: {
    file: './lib/build.js',
    format: 'iife', // 指定模块形式
    name: 'myVue',
  }
}
export default config