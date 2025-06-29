import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import copy from 'rollup-plugin-copy';

const isProduction = process.env.NODE_ENV === 'production';

export default [
  // Browser UMD bundle
  {
    input: 'src/index.js',
    output: {
      file: 'dist/grupogps-alert-system.js',
      format: 'umd',
      name: 'GrupoGpsAlertSystem',
      sourcemap: !isProduction
    },
    plugins: [
      resolve({
        browser: true
      }),
      commonjs(),
      copy({
        targets: [
          { src: 'public/*', dest: 'dist/standalone' },
          { src: 'data-templates/*', dest: 'dist/data-templates' },
          { src: 'docs/*', dest: 'dist/docs' }
        ]
      })
    ]
  },
  
  // Browser UMD minified bundle
  {
    input: 'src/index.js',
    output: {
      file: 'dist/grupogps-alert-system.min.js',
      format: 'umd',
      name: 'GrupoGpsAlertSystem',
      sourcemap: true
    },
    plugins: [
      resolve({
        browser: true
      }),
      commonjs(),
      terser({
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction
        },
        format: {
          comments: false
        }
      })
    ]
  },
  
  // ES module bundle
  {
    input: 'src/index.js',
    output: {
      file: 'dist/grupogps-alert-system.esm.js',
      format: 'esm',
      sourcemap: !isProduction
    },
    plugins: [
      resolve(),
      commonjs()
    ]
  }
];
