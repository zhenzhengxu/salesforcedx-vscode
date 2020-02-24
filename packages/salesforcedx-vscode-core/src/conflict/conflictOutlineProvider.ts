/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { isNullOrUndefined } from '@salesforce/salesforcedx-utils-vscode/out/src/helpers';
import * as path from 'path';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { conflictResolutionService } from '.';

export type ConflictFile = {
  fileName: string; // should be relPath, fileName, type, ...
  localPath: string;
  remotePath: string;
};

export enum ConflictDisposition {
  Unresolved,
  AcceptLocal,
  AcceptRemote
}

export type ConflictEntry = ConflictFile & {
  type: string;
  disposition: ConflictDisposition;
};

const RESOURCE_PATH = path.join(
  __filename,
  '..',
  '..',
  '..',
  '..',
  'resources'
);
const LIGHT_UNRESOLVED = path.join(RESOURCE_PATH, 'light', 'openConflict.svg');
const LIGHT_RESOLVED = path.join(
  RESOURCE_PATH,
  'light',
  'resolvedConflict.svg'
);
const DARK_UNRESOLVED = path.join(RESOURCE_PATH, 'dark', 'openConflict.svg');
const DARK_RESOLVED = path.join(RESOURCE_PATH, 'dark', 'resolvedConflict.svg');

export class ConflictOutlineProvider
  implements vscode.TreeDataProvider<ConflictNode> {
  private root: ConflictNode;
  private conflicts: ConflictEntry[];

  private internalOnDidChangeTreeData: vscode.EventEmitter<
    ConflictNode | undefined
  > = new vscode.EventEmitter<ConflictNode | undefined>();
  public readonly onDidChangeTreeData: vscode.Event<
    ConflictNode | undefined
  > = this.internalOnDidChangeTreeData.event;

  public constructor() {
    this.conflicts = [];
    this.root = new ConflictNode(
      nls.localize('conflict_detect_not_accessed'),
      vscode.TreeItemCollapsibleState.None
    );
  }

  public async onViewChange() {
    this.internalOnDidChangeTreeData.fire();
  }

  public async refresh(node?: ConflictNode): Promise<void> {
    this.internalOnDidChangeTreeData.fire(node);
  }

  public reset(rootLabel: string, conflicts: ConflictEntry[]) {
    this.conflicts = conflicts;
    this.root = new ConflictNode(
      rootLabel,
      vscode.TreeItemCollapsibleState.Expanded,
      () => this.updateDisposition()
    );

    this.root.setComponents(conflicts);
    this.internalOnDidChangeTreeData.fire(this.root);
  }

  public getTreeItem(element: ConflictNode): vscode.TreeItem {
    return element;
  }

  public getParent(element: ConflictNode) {
    return element.parent;
  }

  public getChildren(element?: ConflictNode): ConflictNode[] {
    if (isNullOrUndefined(element)) {
      return [this.root];
    }

    return element.children!;
  }

  private updateDisposition() {
    const allResolved = conflictResolutionService.areAllConflictsResolved(
      this.conflicts
    );
    if (allResolved) {
      // enable 'Perform Operation' action
      this.root.updateIcon(true);
    }
    this.internalOnDidChangeTreeData.fire(this.root);
  }
}

export class ConflictNode extends vscode.TreeItem {
  private _children: ConflictNode[] | undefined;
  private _parent: ConflictNode | undefined;
  private conflict: ConflictEntry | undefined;
  private refresher?: () => void;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    refresher?: () => void
  ) {
    super(label, collapsibleState);
    this.refresher = refresher;
    this.iconPath = {
      light: LIGHT_UNRESOLVED,
      dark: DARK_UNRESOLVED
    };
  }

  public setComponents(conflicts: ConflictEntry[]) {
    this._children = [];

    if (conflicts.length === 0) {
      this._children.push(
        new ConflictNode(
          nls.localize('conflict_detect_no_conflicts'),
          vscode.TreeItemCollapsibleState.None
        )
      );
    }

    conflicts.forEach(entry => {
      const child = new ConflictNode(
        entry.fileName,
        vscode.TreeItemCollapsibleState.Expanded
      );

      // contextValue corresponds to viewItem in view/item/context section of package.json
      child.contextValue = 'metadata';
      child._parent = this;
      child.conflict = entry;
      this._children!.push(child);
      this.attachActions(child);

      child.command = {
        title: 'Compare',
        command: 'sfdx.force.conflict.diff',
        arguments: [entry]
      };
    });
  }

  public updateResolution(dispostion: ConflictDisposition) {
    if (this.conflict) {
      this.conflict.disposition = dispostion;
      this.updateIcon(
        this.conflict.disposition !== ConflictDisposition.Unresolved
      );
      this.refresh();
    }
  }

  public updateIcon(isResolved: boolean) {
    if (isResolved) {
      this.iconPath = {
        light: LIGHT_RESOLVED,
        dark: DARK_RESOLVED
      };
    } else {
      this.iconPath = {
        light: LIGHT_UNRESOLVED,
        dark: DARK_UNRESOLVED
      };
    }
  }

  public refresh() {
    if (this.refresher) {
      this.refresher();
    }
    if (this.parent) {
      this.parent.refresh();
    }
  }

  get parent() {
    return this._parent;
  }

  get children() {
    return this._children;
  }

  get tooltip() {
    return this.label;
  }

  private attachActions(c: ConflictNode) {
    const actions = new ConflictNode(
      'Actions',
      vscode.TreeItemCollapsibleState.None
    );
    c._children = [actions];
    actions._parent = c;
    actions.iconPath = undefined;
    actions.contextValue = 'conflict-actions';
  }
}

export function performOperation(entry: ConflictEntry) {}

export function acceptLocal(entry: ConflictNode) {
  if (entry.parent) {
    entry.parent.updateResolution(ConflictDisposition.AcceptLocal);
  }
}

export function acceptRemote(entry: ConflictNode) {
  if (entry.parent) {
    entry.parent.updateResolution(ConflictDisposition.AcceptRemote);
  }
}
