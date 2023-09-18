
import { Plugin, defineConfig } from 'rollup';
import tsPlugin from '@rollup/plugin-typescript';
import nodeResolvePlugin from '@rollup/plugin-node-resolve';
import commonjsPlugin from '@rollup/plugin-commonjs';
import jsonPlugin from '@rollup/plugin-json';
import { readFile } from 'fs/promises';
import closureCompilerPlugin from '@ampproject/rollup-plugin-closure-compiler';

const config = defineConfig([
  {
    input: "src/main.ts",
    output: {
      dir: "build",
      format: "iife",
    },
    onwarn(warning, warn) {
      if (warning.code !== 'THIS_IS_UNDEFINED') {
        warn(warning);
      }
    },
    plugins: [
      tsPlugin({
      }),
      nodeResolvePlugin({
      }),
      commonjsPlugin({
      }),
      projectPlugin({
      }),
      closureCompilerPlugin({
      }),
      jsonPlugin({
      }),
    ],
  },
  {
    input: "src/convert-image-worker.ts",
    output: {
      dir: "build",
      format: "iife",
    },
    onwarn(warning, warn) {
      if (warning.code !== 'THIS_IS_UNDEFINED') {
        warn(warning);
      }
    },
    plugins: [
      tsPlugin({
      }),
      nodeResolvePlugin({
      }),
      commonjsPlugin({
      }),
      projectPlugin({
      }),
      closureCompilerPlugin({
      }),
      jsonPlugin({
      }),
    ],
  },
]);

interface ProjectPluginOptions {
}

function projectPlugin(options: ProjectPluginOptions = {}): Plugin {
  return {
    name: 'project-specific',
    async load(id) {
      if (/\.(?:html|svg|png|css)$/i.test(id)) {
        const file = await readFile(id);
        const result = this.emitFile({
          type: 'asset',
          fileName: id.match(/[^\\/]+$/)![0],
          source: file,
        });
        return `
        export const url = import.meta.ROLLUP_FILE_URL_${result};
        `;
      }
      else {
        return null;
      }
    },
  };
}

export default config;
