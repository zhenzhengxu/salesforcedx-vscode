/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import * as path from 'path';
import { nls } from '../messages';
import { ConflictDisposition, ConflictEntry } from './types';

const RESOURCE_PATH = path.join(
  __filename,
  '..',
  '..',
  '..',
  '..',
  'resources'
);
const LIGHT_UNRESOLVED = path.join(RESOURCE_PATH, 'light', 'openConflict.svg');
const DARK_UNRESOLVED = path.join(RESOURCE_PATH, 'dark', 'openConflict.svg');
const DARK_LOCAL = path.join(RESOURCE_PATH, 'dark', 'triangle-right.svg');
const DARK_REMOTE = path.join(RESOURCE_PATH, 'dark', 'triangle-left.svg');
const LIGHT_LOCAL = path.join(RESOURCE_PATH, 'light', 'triangle-right.svg');
const LIGHT_REMOTE = path.join(RESOURCE_PATH, 'light', 'triangle-left.svg');

export class ConflictNode extends vscode.TreeItem {
  private _children: ConflictNode[];
  private _parent: ConflictNode | undefined;
  protected _conflict: ConflictEntry | undefined;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    parent?: ConflictNode
  ) {
    super(label, collapsibleState);
    this._children = [];
    this._parent = parent;
  }

  get conflict() {
    return this._conflict;
  }

  get parent() {
    return this._parent;
  }

  get children() {
    return this._children;
  }

  get tooltip() {
    return this._conflict ? this._conflict.relPath : this.label;
  }

  public link(child: ConflictNode) {
    this._children.push(child);
    child._parent = this;
  }

  public refresh() {
    if (this.parent) {
      this.parent.refresh();
    }
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
      let lightIcon;
      let darkIcon;
      if (this.conflict) {
        lightIcon =
          this.conflict.disposition === ConflictDisposition.AcceptLocal
            ? LIGHT_LOCAL
            : LIGHT_REMOTE;
        darkIcon =
          this.conflict.disposition === ConflictDisposition.AcceptLocal
            ? DARK_LOCAL
            : DARK_REMOTE;
        this.iconPath = {
          light: lightIcon,
          dark: darkIcon
        };
      }
    } else {
      this.iconPath = {
        light: LIGHT_UNRESOLVED,
        dark: DARK_UNRESOLVED
      };
    }
  }
}

export class ConflictFileNode extends ConflictNode {
  constructor(conflict: ConflictEntry, parent: ConflictNode) {
    super(conflict.fileName, vscode.TreeItemCollapsibleState.Expanded, parent);
    this._conflict = conflict;
  }

  public attachCommands() {
    this.contextValue = 'conflict-actions';
    this.command = {
      title: nls.localize('conflict_detect_diff_command_title'),
      command: 'sfdx.force.conflict.diff',
      arguments: [this._conflict]
    };
    this.attachActions();
  }

  private attachActions() {
    const actions = new ConflictNode(
      'Unresolved',
      vscode.TreeItemCollapsibleState.None
    );
    this.link(actions);
    actions.iconPath = undefined;
    actions.contextValue = 'conflict-resolve-actions';
  }
}

export class ConflictGroupNode extends ConflictNode {
  private refresher?: () => void;

  constructor(label: string, refresher?: () => void) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.refresher = refresher;
  }

  public refresh() {
    if (this.refresher) {
      this.refresher();
    }
  }

  public addChildren(conflicts: ConflictEntry[]) {
    if (conflicts.length === 0) {
      this.children.push(
        new ConflictNode(
          nls.localize('conflict_detect_no_conflicts'),
          vscode.TreeItemCollapsibleState.None
        )
      );
    }

    conflicts.forEach(entry => {
      const child = new ConflictFileNode(entry, this);
      child.attachCommands();
      this.children!.push(child);
    });
  }
}
