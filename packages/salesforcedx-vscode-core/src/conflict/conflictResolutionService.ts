/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { ConflictDisposition, ConflictEntry } from './conflictOutlineProvider';
import { DirectoryDiffResults } from './directoryDiffer';

export class ConflictResolutionService {
  private static instance: ConflictResolutionService;

  public static getInstance(): ConflictResolutionService {
    if (!ConflictResolutionService.instance) {
      ConflictResolutionService.instance = new ConflictResolutionService();
    }
    return ConflictResolutionService.instance;
  }

  public createConflictEntries(
    diffResults: DirectoryDiffResults
  ): ConflictEntry[] {
    const conflicts: ConflictEntry[] = [];

    diffResults.different.forEach(p => {
      conflicts.push({
        fileName: p,
        localPath: diffResults.localRoot,
        remotePath: diffResults.remoteRoot,
        disposition: ConflictDisposition.Unresolved
      } as ConflictEntry);
    });

    return conflicts;
  }

  public areAllConflictsResolved(conflicts: ConflictEntry[]): boolean {
    const resolved = conflicts.every(
      c => c.disposition !== ConflictDisposition.Unresolved
    );
    return resolved;
  }

  public performRetrieve(
    results: DirectoryDiffResults,
    conflicts: ConflictEntry[]
  ) {
    // copy missing local files from remote cache into the project
    results.missingLocal.forEach(p => {
      const source = path.join(results.remoteRoot, p);
      const target = path.join(results.localRoot, p);
      this.copyFile(source, target);
    });

    // copy accepted remote files from remote cache into the project
    this.acceptRemote(conflicts);
  }

  public prepareDeploy(
    results: DirectoryDiffResults,
    conflicts: ConflictEntry[]
  ) {
    // update the project to match org state for all selected files
    // this needs to be done prior to a deploy
    this.acceptRemote(conflicts);
  }

  private acceptRemote(conflicts: ConflictEntry[]) {
    conflicts.forEach(c => {
      if (c.disposition === ConflictDisposition.AcceptRemote) {
        const source = path.join(c.remotePath, c.fileName);
        const target = path.join(c.localPath, c.fileName);
        this.copyFile(source, target);
      }
    });
  }

  private copyFile(source: string, target: string) {
    const cmd = `cp ${source} ${target}`;
    console.log(cmd);
  }
}
