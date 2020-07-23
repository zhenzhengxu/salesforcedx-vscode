import {
  ManifestGenerator,
  RegistryAccess
} from '@salesforce/source-deploy-retrieve';
import { MetadataComponent } from '@salesforce/source-deploy-retrieve/lib/types';
import * as vscode from 'vscode';
import { nls } from '../../messages';
export class StageNode extends vscode.TreeItem {
  public parent?: StageNode;
  public readonly children: StageNode[] = [];

  public readonly typeName?: string;

  constructor(
    label: string,
    collapsableState?: vscode.TreeItemCollapsibleState,
    typeName?: string
  ) {
    super(label, collapsableState);
    this.typeName = typeName;
    this.iconPath = !typeName ? vscode.ThemeIcon.File : '';
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

  public getParent(element: StageNode): StageNode | undefined {
    return element.parent;
  }

  public getChildren(element?: StageNode | undefined): Promise<StageNode[]> {
    if (element) {
      return Promise.resolve(element.children);
    }
    return Promise.resolve(Array.from(this.typeNameToNode.values()));
  }

  public addComponent(component: {
    fullName: string;
    type: string;
  }): StageNode {
    const { fullName, type: mdType } = component;

    if (!this.typeNameToNode.has(mdType)) {
      const typeLabel = nls.localize(mdType);
      this.typeNameToNode.set(
        mdType,
        new StageNode(
          typeLabel,
          vscode.TreeItemCollapsibleState.Expanded,
          mdType
        )
      );
    }
    const typeNode = this.typeNameToNode.get(mdType)!;

    let componentNode = typeNode.children.find(
      child => child.label === fullName
    );
    if (!componentNode) {
      componentNode = new StageNode(fullName);
      typeNode.addChild(componentNode);
      typeNode.children.sort((a: StageNode, b: StageNode) =>
        a.label!.localeCompare(b.label!)
      );
    }

    this._onDidChangeTreeData.fire();

    return componentNode;
  }

  public removeComponent(node: StageNode): void {
    if (node.parent) {
      const index = node.parent.children.findIndex(
        child => child.label === node.label
      );
      node.parent.children.splice(index, 1);
      if (node.parent.children.length === 0) {
        this.typeNameToNode.delete(node.parent.typeName!);
      }
      node.parent = undefined;
      this._onDidChangeTreeData.fire();
    }
    if (node.children.length > 0) {
      node.parent = undefined;
      this.typeNameToNode.delete(node.typeName!);
      this._onDidChangeTreeData.fire();
    }
  }

  public async createManifest(output: vscode.Uri): Promise<void> {
    if (this.typeNameToNode.size > 0) {
      const registryAccess = new RegistryAccess();
      const manifestGenerator = new ManifestGenerator();
      const components: MetadataComponent[] = [];
      for (const typeNode of this.typeNameToNode.values()) {
        const type = registryAccess.getTypeFromName(typeNode.typeName!);
        for (const componentNode of typeNode.children) {
          components.push({
            fullName: componentNode.label!,
            type,
            xml: ''
          });
        }
      }
      const encoder = new TextEncoder();
      const contents = encoder.encode(
        manifestGenerator.createManifest(components)
      );
      await vscode.workspace.fs.writeFile(output, contents);
    }
  }

  public clearAll(): void {
    this.typeNameToNode.clear();
    this._onDidChangeTreeData.fire();
  }
}
