/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { DirFileNameSelection } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { ExtensionContext, TreeView, window } from 'vscode';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';
import {
  ConflictNode,
  ConflictOutlineProvider
} from './conflictOutlineProvider';

export class ConflictView {
  private static VIEW_ID = 'conflicts';
  private static instance: ConflictView;

  private _treeView?: TreeView<ConflictNode>;
  private _dataProvider?: ConflictOutlineProvider;

  private constructor() {}

  public static getInstance(): ConflictView {
    if (!this.instance) {
      this.instance = new ConflictView();
    }
    return this.instance;
  }

  get treeView() {
    if (this._treeView) {
      return this._treeView;
    }
    throw this.initError();
  }

  get dataProvider() {
    if (this._dataProvider) {
      return this._dataProvider;
    }
    throw this.initError();
  }

  public async init(extensionContext: ExtensionContext) {
    this._dataProvider = new ConflictOutlineProvider();
    this._treeView = window.createTreeView(ConflictView.VIEW_ID, {
      treeDataProvider: this._dataProvider
    });
    this._treeView.onDidChangeVisibility(async () => {
      if (this.treeView.visible) {
        await this.dataProvider.onViewChange();
      }
    });
    extensionContext.subscriptions.push(this._treeView);
  }

  public reset(orgLabel: string, resources: DirFileNameSelection[]) {
    if (this._dataProvider) {
      this._dataProvider.reset(orgLabel, resources);
      const root = this._dataProvider.getChildren(undefined);
      this.treeView.reveal(root[0], { expand: true });
    }
  }

  public async refreshAndExpand(node: ConflictNode) {
    await this.dataProvider.refresh(node);
    await this.treeView.reveal(node, { expand: true });
  }

  private initError() {
    const message = nls.localize('error_org_browser_init');
    telemetryService.sendException('OrgBrowserException', message);
    return new Error(message);
  }
}
