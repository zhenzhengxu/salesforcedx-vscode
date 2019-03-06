/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import {
  EmptyParametersGatherer,
  FlagParameter,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

import { getRootWorkspacePath } from '../util/rootWorkspace';

import * as vscode from 'vscode';

export class NonexistentCommand extends SfdxCommandletExecutor<{}> {
  public build(data: { username?: string }): Command {
    const builder = new SfdxCommandBuilder()
      .withDescription('Executing nonexistent command')
      .withArg('force:blah:blah')
      .withLogName('force_blah_blah');

    return builder.build();
  }
  public execute(response: ContinueResponse<{}>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: getRootWorkspacePath()
    }).execute(cancellationToken);

    execution.stdoutSubject.subscribe(realData => {
      console.log(realData);
    });
    execution.processExitSubject.subscribe(() => {
      this.logMetric(execution.command.logName, startTime);
    });
    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
  }
}

export async function nonexistentCommand(this: FlagParameter<string>) {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new EmptyParametersGatherer(),
    new NonexistentCommand()
  );
  await commandlet.run();
}
