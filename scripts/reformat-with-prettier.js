#!/usr/bin/env node

const path = require('path');
const shell = require('shelljs');

console.log('**********************');
console.log('reformat with prettier');
console.log('**********************');
const prettierExecutable = path.join(
  __dirname,
  '..',
  'node_modules',
  '.bin',
  'prettier'
);

console.log('**********************');
console.log('prettier executable = ', prettierExecutable);
console.log('**********************');
const log = shell.exec(
  `${prettierExecutable} --write --config .prettierrc.json 'package.json'`,
  {
    cwd: path.join(__dirname, '..')
  }
).stdout;

console.log('**********************');
console.log('prettier exec log = ', log);
console.log('**********************');
