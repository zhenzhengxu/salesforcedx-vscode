import {
  MetadataComponent,
  MetadataType
} from '@salesforce/source-deploy-retrieve/lib/types';
import * as vscode from 'vscode';
import { BrowserNode, NodeType } from '../nodeTypes';

enum NodeTypes {
  Component,
  Type
}

class StageNode extends vscode.TreeItem {
  // private component: MetadataComponent;
  private nodeType: NodeType;

  constructor(
    nodeType: NodeType,
    label: string,
    collapsableState?: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsableState);
    this.nodeType = nodeType;
  }

  // get tooltip() {
  //   const { fullName, type } = this.component;
  //   return `${type.name} - ${fullName}`;
  // }
}

export class ComponentStageOutlineProvider
  implements vscode.TreeDataProvider<StageNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    StageNode | undefined
  > = new vscode.EventEmitter<StageNode | undefined>();
  public readonly onDidChangeTreeData: vscode.Event<
    StageNode | undefined
  > = this._onDidChangeTreeData.event;

  public getTreeItem(element: StageNode): TreeItem {
    return element;
  }

  public getChildren(element?: StageNode | undefined): Promise<StageNode[]> {
    if (!element) {
    }
    return Promise.resolve([new StageNode()]);
  }
}
