import * as vscode from 'vscode';

interface MetadataComponent {
  fullName: string;
  type: string;
}

export class StageNode extends vscode.TreeItem {
  public parent?: StageNode;
  public readonly children: StageNode[] = [];

  constructor(
    label: string,
    collapsableState?: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsableState);
  }

  public addChild(node: StageNode): void {
    node.parent = this;
    this.children.push(node);
  }
}

export class ComponentStageOutlineProvider
  implements vscode.TreeDataProvider<StageNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    StageNode | undefined
  > = new vscode.EventEmitter<StageNode | undefined>();
  public readonly onDidChangeTreeData: vscode.Event<
    StageNode | undefined
  > = this._onDidChangeTreeData.event;

  private typeNameToNode = new Map<string, StageNode>();

  public getTreeItem(element: StageNode): StageNode {
    return element;
  }

  public getChildren(element?: StageNode | undefined): Promise<StageNode[]> {
    if (element) {
      return Promise.resolve(element.children);
    }
    return Promise.resolve(Array.from(this.typeNameToNode.values()));
  }

  public addComponent(component: MetadataComponent) {
    const { fullName, type: mdType } = component;

    if (!this.typeNameToNode.has(mdType)) {
      this.typeNameToNode.set(
        mdType,
        new StageNode(mdType, vscode.TreeItemCollapsibleState.Expanded)
      );
    }
    const typeNode = this.typeNameToNode.get(mdType)!;

    let componentNode = typeNode.children.find(
      child => child.label === fullName
    );
    if (!componentNode) {
      componentNode = new StageNode(fullName);
      typeNode.addChild(componentNode);
    }

    this._onDidChangeTreeData.fire();
  }

  public removeComponent(node: StageNode): void {
    if (node.parent) {
      const index = node.parent.children.findIndex(
        child => child.label === node.label
      );
      node.parent.children.splice(index, 1);
      if (node.parent.children.length === 0) {
        this.typeNameToNode.delete(node.parent.label!);
      }
      node.parent = undefined;
      this._onDidChangeTreeData.fire();
    }
  }

  public clearAll(): void {
    this.typeNameToNode.clear();
    this._onDidChangeTreeData.fire();
  }
}
