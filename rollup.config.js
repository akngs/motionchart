import typescript from 'rollup-plugin-typescript3'

export default {
  external: ['d3'],
  input: 'src/index.ts',
  output: [
    {
      file: 'lib/motionchart.cjs.js',
      format: 'cjs',
    },
    {
      file: 'lib/motionchart.esm.js',
      format: 'esm',
    },
    {
      file: 'lib/motionchart.js',
      sourcemap: true,
      name: 'motionchart',
      format: 'iife',
      globals: {
        'd3': 'd3'
      },
    }
  ],
  plugins: [
    typescript(),
  ],
}
