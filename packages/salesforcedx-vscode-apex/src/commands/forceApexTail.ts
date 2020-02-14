/*
 * Copyright (c) 2019, salesforce.com, inc.
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
import * as fs from 'fs';
import * as path from 'path';
import { Subject } from 'rxjs/Subject';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { ApexTailHandler, ApexTailService } from './apexTailService';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const {
  channelService,
  taskViewService,
  notificationService,
  SfdxCommandlet,
  ProgressNotification,
  EmptyParametersGatherer,
  SfdxWorkspaceChecker
} = sfdxCoreExports;
const SfdxCommandletExecutor = sfdxCoreExports.SfdxCommandletExecutor;

export class ForceApexTailExecutor extends SfdxCommandletExecutor<{}> {
  public build(): Command {
    return new SfdxCommandBuilder()
      .withDescription('apex log tail')
      .withArg('force:apex:log:tail')
      .withFlag('--debuglevel', 'ReplayDebuggerLevels1581620577420')
      .withLogName('force_apex_log_tail')
      .build();
  }

  public execute(response: ContinueResponse<{}>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const executor = new CliCommandExecutor(this.build(), {
      cwd: this.executionCwd,
      env: { SFDX_JSON_TO_STDOUT: 'true' }
    });
    const execution = executor.execute(cancellationToken);
    const executionName = execution.command.toString();

    const serverHandler: ApexTailHandler = {
      stop: async () => {
        return execution.killExecution('SIGTERM');
      }
    };
    ApexTailService.instance.registerHandler(serverHandler);

    // channelService.streamCommandOutput(execution);
    // channelService.showChannelOutput();
    /*
    const progress = new Subject();
    ProgressNotification.show(
      execution,
      cancellationTokenSource,
      vscode.ProgressLocation.Notification,
      progress.asObservable()
    ); */

    // listen for command startup
    let stdOut = '';
    execution.stdoutSubject.subscribe(data => {
      console.log('========> listening to command startup');
      stdOut += data.toString();
      // console.log(data.toString());
    });

    // handler errors
    execution.processExitSubject.subscribe(async exitCode => {
      console.log(
        '===> Contains user_debug ??' + stdOut.includes('USER_DEBUG')
      );
      console.log('=== stdOut ====>', stdOut);

      if (stdOut.includes('USER_DEBUG')) {
        const fauxClassPath = path.join(
          vscode.workspace.workspaceFolders![0].uri.fsPath,
          '.sfdx',
          'tools',
          'stream.log'
        );
        fs.writeFileSync(fauxClassPath, stdOut);
        vscode.commands.executeCommand(
          'sfdx.launch.replay.debugger.streamed.logfile'
        );
        console.log('lets get fancy');
        const regex = /((\d+\:\d+\:\d+\.\d+)\s*(\([0-9]+\))(\|)(USER_DEBUG)(\|)(\[\d*\])(\|)(DEBUG)(\|)([A-Za-z\s]*)(?:(\d+\:\d+\:\d+\.\d+)))|((\d+\:\d+\:\d+\.\d+)\s*(\([0-9]+\))(\|)(EXCEPTION_THROWN)(\|)(\[\d+\])(\|)([A-Za-z0-9\s\:\.\,]*)(?:(\d{2}\:\d+\:\d+\.\d+)))/g;
        const found = stdOut.match(regex);
        console.log('=== found ====>', found);
        if (found) {
          const userDebugRegex = /(\d+\:\d+\:\d+\.\d+)\s*(\([0-9]+\))(\|)(USER_DEBUG)(\|)(\[\d*\])(\|)(DEBUG)(\|)([A-Za-z\s]*)(?:(\d+\:\d+\:\d+\.\d+))/g;
          const exceptionRegex = /(\d+\:\d+\:\d+\.\d+)\s*(\([0-9]+\))(\|)(EXCEPTION_THROWN)(\|)(\[\d+\])(\|)([A-Za-z0-9\s\:\.\,]*)(?:(\d{2}\:\d+\:\d+\.\d+))/g;
          let completeLog = '';
          let matchUD = null;
          let matchET = null;
          found.forEach(log => {
            console.log('====== iterate log line =====> ', log);

            if (log.includes('USER_DEBUG')) {
              matchUD = logRegex(userDebugRegex, log); // userDebugRegex.exec(log);
              console.log('====== user debug, matchUD =====> ', matchUD);
              if (matchUD) {
                completeLog += matchUD[4] + ': ' + matchUD[10];
              }
            }

            if (log.includes('EXCEPTION_THROWN')) {
              matchET = logRegex(exceptionRegex, log); // exceptionRegex.exec(log);
              console.log('====== exception thrown, matchET =====> ', matchET);
              if (matchET) {
                completeLog += matchET[4] + ': ' + matchET[8];
              }
            }
          });
          channelService.appendLine(completeLog);
        }
      }
    });

    cancellationToken.onCancellationRequested(() => {
      notificationService.showWarningMessage(
        nls.localize('command_canceled', executionName)
      );
      this.showChannelOutput();
    });
  }
}

function logRegex(rEx: RegExp, logLine: string): string[] | null {
  return rEx.exec(logLine);
}

export async function forceApexTailStart() {
  // add a handler ????
  const preconditionChecker = new SfdxWorkspaceChecker();
  const parameterGatherer = new EmptyParametersGatherer();
  const executor = new ForceApexTailExecutor();

  const commandlet = new SfdxCommandlet(
    preconditionChecker,
    parameterGatherer,
    executor
  );

  await commandlet.run();
}

export async function forceApexTailStop() {
  try {
    if (ApexTailService.instance.isHandlerRegistered()) {
      // channelService.appendLine('Successfully stopped Apex Tail');
      await ApexTailService.instance.stopService();
      /* notificationService.showSuccessfulExecution(
        'Successfully stopped Apex Tail'
      ); */
    } else {
      notificationService.showWarningMessage(
        'Something wrong happened with Apex Tail Stop'
      );
    }
  } catch (e) {
    console.log('Something wrong happened with Apex Tail Stop');
    console.log(e);
  }
}
