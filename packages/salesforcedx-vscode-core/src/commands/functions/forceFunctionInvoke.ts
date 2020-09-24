/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Executes sfdx evergreen:function:invoke http://localhost:8080 --payload=@functions/MyFunction/payload.json
 */
import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { nls } from '../../messages';
import { getRootWorkspace } from '../../util';
import {
  FilePathGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '../util';

export class ForceFunctionInvoke extends SfdxCommandletExecutor<string> {
  public build(payloadUri: string): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_function_invoke_text'))
      .withArg('evergreen:function:invoke')
      .withArg('http://localhost:8080')
      .withFlag('--payload', `@${payloadUri}`)
      .withLogName('force_function_invoke')
      .build();
  }
}

export async function forceFunctionInvoke(sourceUri: Uri) {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new FilePathGatherer(sourceUri),
    new ForceFunctionInvoke()
  );
  await commandlet.run();
}

export async function forceFunctionDebugInvoke(sourceUri: Uri) {
  // TODO: what if already attached.
  // TODO: handle local root
  // TODO: telemetry

  const debugConfiguration: vscode.DebugConfiguration = {
    type: 'node',
    request: 'attach',
    name: 'Debug Send Request',
    resolveSourceMapLocations: ['**', '!**/node_modules/**'],
    console: 'integratedTerminal',
    internalConsoleOptions: 'openOnSessionStart',
    localRoot: '${workspaceFolder}/functions/testTsFunction',
    remoteRoot: '/workspace',
    port: 9222
    // disableOptimisticBPs: true
  };
  await vscode.debug.startDebugging(getRootWorkspace(), debugConfiguration);

  await forceFunctionInvoke(sourceUri);
}
