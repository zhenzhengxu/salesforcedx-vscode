/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { ConflictGroupNode, ConflictNode } from './conflictNode';
import { ConflictDisposition, ConflictEntry, ConflictFile } from './types';
import { conflictResolutionService } from '.';

export class ConflictOutlineProvider
  implements vscode.TreeDataProvider<ConflictNode> {
  private root: ConflictGroupNode | null;
  private conflicts: ConflictEntry[];

  private internalOnDidChangeTreeData: vscode.EventEmitter<
    ConflictNode | undefined
  > = new vscode.EventEmitter<ConflictNode | undefined>();
  public readonly onDidChangeTreeData: vscode.Event<
    ConflictNode | undefined
  > = this.internalOnDidChangeTreeData.event;

  public constructor() {
    this.root = null;
    this.conflicts = [];
  }

  public onViewChange() {
    this.internalOnDidChangeTreeData.fire();
  }

  public async refresh(node?: ConflictNode): Promise<void> {
    this.internalOnDidChangeTreeData.fire(node);
  }

  public reset(rootLabel: string, conflicts: ConflictEntry[]) {
    this.conflicts = conflicts;
    this.root = this.createConflictRoot(rootLabel, conflicts);

    setAllConflictsResolved(false);
    setResolutionInProgress(conflicts.length > 0);
  }

  public getRevealNode(): ConflictNode | null {
    return this.root;
  }

  public getTreeItem(element: ConflictNode): vscode.TreeItem {
    if (element) {
      return element;
    }
    if (this.root) {
      return this.root;
    }
    return { label: 'EMPTY' };
  }

  public getChildren(element?: ConflictNode): ConflictNode[] {
    if (element) {
      return element.children!;
    }
    if (this.root) {
      return [this.root];
    }
    return [];
  }

  public getParent(element: ConflictNode) {
    return element.parent;
  }

  private updateDisposition() {
    const allResolved = conflictResolutionService.areAllConflictsResolved(
      this.conflicts
    );
    if (allResolved) {
      setAllConflictsResolved(true);
      if (this.root) {
        this.root.updateIcon(true);
      }
    }
    // this.internalOnDidChangeTreeData.fire(this.root);
    this.internalOnDidChangeTreeData.fire();
  }

  private createConflictRoot(
    rootLabel: string,
    conflicts: ConflictEntry[]
  ): ConflictGroupNode {
    const orgRoot = new ConflictGroupNode(rootLabel, () =>
      this.updateDisposition()
    );
    orgRoot.id = 'ROOT-NODE';
    orgRoot.addChildren(conflicts);
    return orgRoot;
  }
}

export function acceptLocal(entry: ConflictNode) {
  entry.label = 'Local';
  if (entry.parent) {
    entry.parent.updateResolution(ConflictDisposition.AcceptLocal);
  }
}

export function acceptRemote(entry: ConflictNode) {
  entry.label = 'Remote';
  if (entry.parent) {
    entry.parent.updateResolution(ConflictDisposition.AcceptRemote);
  }
}

function setAllConflictsResolved(val: boolean) {
  vscode.commands.executeCommand(
    'setContext',
    'sfdx:all_conflicts_resolved',
    val
  );
}

function setResolutionInProgress(val: boolean) {
  vscode.commands.executeCommand(
    'setContext',
    'sfdx:conflict_resolution_in_progress',
    val
  );
}
