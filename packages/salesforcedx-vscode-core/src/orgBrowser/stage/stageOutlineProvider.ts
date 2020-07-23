import { TreeDataProvider, TreeItem } from 'vscode';
import { BrowserNode, NodeType } from '../nodeTypes';

export class ComponentStageOutlineProvider
  implements TreeDataProvider<BrowserNode> {
  // onDidChangeTreeData?:
  //   | import('vscode').Event<BrowserNode | null | undefined>
  //   | undefined;

  public getTreeItem(element: BrowserNode): TreeItem {
    return element;
  }

  public getChildren(
    element?: BrowserNode | undefined
  ): Promise<BrowserNode[]> {
    if (!element) {
    }
    return Promise.resolve([new BrowserNode('Test!', NodeType.MetadataType)]);
  }
}
