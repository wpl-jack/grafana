import resolve from '@rollup/plugin-node-resolve';
import path from 'path';
import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';
import { externals } from 'rollup-plugin-node-externals';
import svg from 'rollup-plugin-svg-import';

const pkg = require('./package.json');
const name = pkg.main.replace(/\.js$/, '');

const bundle = (config) => ({
  input: 'src/index.ts',
  plugins: [externals({ deps: true, packagePath: './package.json' }), resolve(), svg({ stringify: true }), esbuild()],
  ...config,
});

export default [
  bundle({
    output: [
      {
        format: 'cjs',
        dir: path.dirname(pkg.main),
      },
      {
        format: 'esm',
        dir: path.dirname(pkg.module),
        preserveModules: true,
        // @ts-expect-error
        preserveModulesRoot: path.join(process.env.PROJECT_CWD, `packages/grafana-ui/src`),
      },
    ],
  }),
  bundle({
    input: './compiled/index.d.ts',
    plugins: [dts()],
    output: {
      file: `${name}.d.ts`,
      format: 'es',
    },
  }),
];
