/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { taskService } from '@salesforce/salesforcedx-utils-vscode/out/src/tasks';
import { Uri } from 'vscode';
import { nls } from '../../messages';
import { getRootWorkspace } from '../../util';
import {
  CommandletExecutor,
  FilePathGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '../util';

export class ForceFunctionStart extends SfdxCommandletExecutor<string> {
  public build(sourceFsPath: string): Command {
    this.executionCwd = sourceFsPath;
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_function_start_text'))
      .withArg('evergreen:function:start')
      .withArg('--verbose')
      .withLogName('force_function_start')
      .build();
  }
}

/**
 * Executes sfdx evergreen:function:start --verbose
 * @param sourceUri
 */
export async function forceFunctionStart(sourceUri: Uri) {
  const sfdxTask = taskService.createTask({
    taskId: sourceUri.fsPath,
    taskName: 'SFDX: Start Function',
    taskGroup: 'functions',
    taskScope: getRootWorkspace(),
    cmd: 'sfdx',
    args: ['evergreen:function:start', '--verbose'],
    shellExecutionOptions: {
      cwd: sourceUri.fsPath
    }
  });

  sfdxTask.onDidEnd(() => {});

  await sfdxTask.execute();

  // const commandlet = new SfdxCommandlet(
  //   new SfdxWorkspaceChecker(),
  //   new FilePathGatherer(sourceUri),
  //   new ForceFunctionStart()
  // );
  // await commandlet.run();
}
