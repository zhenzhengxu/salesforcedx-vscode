#!/usr/bin/env node

const path = require('path');
const shell = require('shelljs');
const vscodetest = require('vscode-test');

const getExecutable = vscodeInstallPath => {
  const platform = process.platform;
  let executablePath = '';

  switch (platform) {
    case 'darwin':
      executablePath = path.join(
        vscodeInstallPath,
        '..',
        '..',
        'Resources',
        'app',
        'bin',
        'code'
      );
      break;
    case 'win32':
      executablePath = path.join(vscodeInstallPath, '..', 'bin', 'code');
      break;
    default:
      executablePath = path.join(
        vscodeInstallPath,
        '..',
        'VSCode-linux-x64',
        'bin',
        'code'
      );
      return;
  }

  return executablePath;
};

async function go() {
  const vscodeExecutablePath = await vscodetest.downloadAndUnzipVSCode();

  console.log('vscodeExecutablePath ====>', vscodeExecutablePath);

  const executablePath = getExecutable(vscodeExecutablePath);
  console.log('executablePath ====>', executablePath);

  shell.exec(`'${executablePath}' --install-extension dbaeumer.vscode-eslint`);

  process.env.VSCODE_BINARY_PATH = executablePath;

  console.log(
    'process.env.VSCODE_BINARY_PATH => ',
    process.env.VSCODE_BINARY_PATH
  );

  const testRunnerPath = path.join(
    process.cwd(),
    'out',
    'src',
    'mocha-runner.js'
  );

  console.log('testRunnerPath ===> ', testRunnerPath);

  shell.exec(`node ${testRunnerPath}`);
  console.log('local vscode setup is ready!!');
}

go();
