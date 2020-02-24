/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { ConflictDetector } from './conflictDetectionService';
import {
  ConflictFile,
  performOperation,
  acceptLocal,
  acceptRemote
} from './conflictOutlineProvider';
import { ConflictResolutionService } from './conflictResolutionService';
import { ConflictView } from './conflictView';
export {
  ConflictDetectionConfig,
  ConflictDetector
} from './conflictDetectionService';
export {
  CommonDirDirectoryDiffer,
  DirectoryDiffer,
  DirectoryDiffResults
} from './directoryDiffer';
export const conflictDetector = ConflictDetector.getInstance();
export const conflictView = ConflictView.getInstance();
export const conflictResolutionService = ConflictResolutionService.getInstance();

export async function registerConflictView(): Promise<vscode.Disposable> {
  const viewItems: vscode.Disposable[] = [];

  viewItems.push(
    vscode.commands.registerCommand('sfdx.force.conflict.diff', entry =>
      conflictDiff(entry)
    )
  );

  viewItems.push(
    vscode.commands.registerCommand('sfdx.force.conflict.perform', entry =>
      performOperation(entry)
    )
  );

  viewItems.push(
    vscode.commands.registerCommand('sfdx.force.conflict.acceptRemote', entry =>
      acceptRemote(entry)
    )
  );

  viewItems.push(
    vscode.commands.registerCommand('sfdx.force.conflict.acceptLocal', entry =>
      acceptLocal(entry)
    )
  );

  return vscode.Disposable.from(...viewItems);
}

function conflictDiff(file: ConflictFile) {
  const local = vscode.Uri.file(path.join(file.localPath, file.fileName));
  const remote = vscode.Uri.file(path.join(file.remotePath, file.fileName));

  // TODO: i18n:
  const title = `REMOTE: ${file.fileName} ↔ LOCAL: ${file.fileName}`;
  vscode.commands.executeCommand('vscode.diff', remote, local, title);
}
