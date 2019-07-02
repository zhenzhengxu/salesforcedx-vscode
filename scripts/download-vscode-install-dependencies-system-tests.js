#!/usr/bin/env node

const path = require('path');
const shell = require('shelljs');
const vscodetest = require('vscode-test');

async function go() {
  const vscodeExecutablePath = await vscodetest.downloadAndUnzipVSCode();

  console.log('vscodeExecutablePath ====>', vscodeExecutablePath);

  const darwinExecutable = path.join(
    vscodeExecutablePath,
    '..',
    '..',
    'Resources',
    'app',
    'bin',
    'code'
  );

  console.log('darwinExecutable ====>', darwinExecutable);

  shell.exec(
    `'${darwinExecutable}' --install-extension dbaeumer.vscode-eslint`
  );
  /*
  const testRunnerPath = path.join(
    process.cwd(),
    'out',
    'src',
    'mocha-runner.js'
  );

  const extensionPath = path.join(process.cwd(), '..');

  console.log('testRunnerPath ===> ', testRunnerPath);

  console.log('extensionPath ===> ', extensionPath);

  await runTests({
    vscodeExecutablePath,
    extensionPath,
    testRunnerPath,
    testWorkspace 
  })
*/
  console.log('local vscode setup is ready!!');
}

go();
