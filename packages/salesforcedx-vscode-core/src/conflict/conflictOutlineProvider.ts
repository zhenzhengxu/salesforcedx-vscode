/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { isNullOrUndefined } from '@salesforce/salesforcedx-utils-vscode/out/src/helpers';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { DirFileNameSelection } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as path from 'path';

export class ConflictOutlineProvider
  implements vscode.TreeDataProvider<ConflictNode> {
  private root: ConflictNode;

  private internalOnDidChangeTreeData: vscode.EventEmitter<
    ConflictNode | undefined
  > = new vscode.EventEmitter<ConflictNode | undefined>();
  public readonly onDidChangeTreeData: vscode.Event<
    ConflictNode | undefined
  > = this.internalOnDidChangeTreeData.event;

  public constructor() {
    this.root = new ConflictNode(
      'Conflicts Not Assessed',
      vscode.TreeItemCollapsibleState.None
    );
  }

  public async onViewChange() {
    this.internalOnDidChangeTreeData.fire();
  }

  public async refresh(node?: ConflictNode): Promise<void> {
    this.internalOnDidChangeTreeData.fire(node);
  }

  public reset(rootLabel: string, resources: DirFileNameSelection[]) {
    this.root = new ConflictNode(
      rootLabel,
      vscode.TreeItemCollapsibleState.Expanded
    );
    this.root.setComponents(resources);
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
}

export class ConflictNode extends vscode.TreeItem {
  public readonly fullName: string;
  public fsPath: string;
  private _children: ConflictNode[] | undefined;
  private _parent: ConflictNode | undefined;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.fullName = label;
    this.fsPath = '';
  }

  public setComponents(resources: DirFileNameSelection[]) {
    this._children = [];

    if (resources.length === 0) {
      this._children.push(
        new ConflictNode('UGH', vscode.TreeItemCollapsibleState.None)
      );
    }

    resources.forEach(file => {
      const label = file.fileName;
      const child = new ConflictNode(
        label,
        vscode.TreeItemCollapsibleState.None
      );
      child.contextValue = 'metadata';
      child._parent = this;
      this._children!.push(child);

      let childPath = path.join('force-app', file.outputdir, file.fileName);
      child.resourceUri = vscode.Uri.file(childPath);
      child.fsPath = childPath;
    });
  }

  get parent() {
    return this._parent;
  }

  get children() {
    return this._children;
  }
}
