/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { channelService } from '../channels';
import { ConflictDisposition, ConflictEntry } from './types';
import { DirectoryDiffResults } from './directoryDiffer';
import { ManifestGenerator } from '@salesforce/source-deploy-retrieve';
import { MetadataComponent } from '@salesforce/source-deploy-retrieve/lib/types';

interface CopyItem {
  source: string;
  target: string;
  backup: string;
}

export class ConflictResolutionService {
  private static instance: ConflictResolutionService;

  public static getInstance(): ConflictResolutionService {
    if (!ConflictResolutionService.instance) {
      ConflictResolutionService.instance = new ConflictResolutionService();
    }
    return ConflictResolutionService.instance;
  }

  public createConflictEntries(
    diffResults: DirectoryDiffResults,
    remoteLabel: string
  ): ConflictEntry[] {
    const conflicts: ConflictEntry[] = [];

    diffResults.different.forEach(p => {
      conflicts.push({
        remoteLabel,
        relPath: p,
        fileName: path.basename(p),
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
    const items: CopyItem[] = [];

    // copy missing local files from remote cache into the project
    const backupDir = this.createBackupFolder();
    results.missingLocal.forEach(p => {
      const source = path.join(results.remoteRoot, p);
      const target = path.join(results.localRoot, p);
      const backup = path.join(backupDir, p);
      const item = { source, target, backup } as CopyItem;
      items.push(item);
    });

    // copy accepted remote files from remote cache into the project
    this.acceptRemote(backupDir, items, conflicts);

    // double dare the operation then copy
    channelService.appendLine('Operations:');
    items.forEach(i => this.copyFile(i));
  }

  public verifyDeploy(): boolean {
    // peform a double dare of the deploy operation
    return true;
  }

  public performDeploy(
    results: DirectoryDiffResults,
    conflicts: ConflictEntry[]
  ) {
    // generate a manifest based on local-selected conflicts and all local files
    // issue a deploy from manifest command
    const manifest = this.generateManifest(results, conflicts);
  }

  public prepareDeploy(
    results: DirectoryDiffResults,
    conflicts: ConflictEntry[]
  ) {
    // update the project to match org state for all selected files
    // this needs to be done prior to a deploy
    const items: CopyItem[] = [];
    const backupDir = this.createBackupFolder();
    this.acceptRemote(backupDir, items, conflicts);
  }

  private generateManifest(
    results: DirectoryDiffResults,
    conflicts: ConflictEntry[]
  ): string {
    const generator = new ManifestGenerator();
    const comps: MetadataComponent[] = [];
    results.different.forEach(p => {
      // HOW-TO-DO-THIS? create a MetadataComponent from: a missing
      // Would need to interpret wildcards, etc.
      // comps.push(comp);
    });

    conflicts.forEach(c => {
      if (c.disposition === ConflictDisposition.AcceptRemote) {
        const target = path.join(c.localPath, c.relPath);
        // create a MetadataComponent from: target
        // comps.push(comp);
      }
    });

    const manifest = generator.createManifest([]);
    return manifest;
  }

  private acceptRemote(
    backupDir: string,
    items: CopyItem[],
    conflicts: ConflictEntry[]
  ) {
    conflicts.forEach(c => {
      if (c.disposition === ConflictDisposition.AcceptRemote) {
        const source = path.join(c.remotePath, c.relPath);
        const target = path.join(c.localPath, c.relPath);
        const backup = path.join(backupDir, c.relPath);
        const item = { source, target, backup } as CopyItem;
        items.push(item);
      }
    });
  }

  private copyFile(item: CopyItem) {
    // const cmd = `cp ${source} ${target}`;
    channelService.appendLine(`Save: ${item.target}`);
    channelService.appendLine(`Copy: ${item.source}`);
    channelService.appendLine(`  To: ${item.target}`);
    channelService.appendLine(` Bku: ${item.backup}`);
    channelService.appendLine('');
    channelService.showChannelOutput();
  }

  private createBackupFolder(): string {
    const name = new Date().getTime().toString();
    channelService.appendLine(`Creating new history folder: ${name}...`);
    return name;
  }
}
