import * as path from 'path';
import * as vscode from 'vscode';

class WebviewService {
  public extensionPath: string = '';

  public register(context: vscode.ExtensionContext) {
    this.extensionPath = context.extensionPath;
  }

  public async createWebview() {
    const viewType = 'lwcPreview';
    const title = 'LWC Preview';
    const activeTextEditorColumn =
      vscode.window.activeTextEditor &&
      vscode.window.activeTextEditor.viewColumn;
    const previewColumn = activeTextEditorColumn
      ? activeTextEditorColumn + 1
      : vscode.ViewColumn.One;

    const panel = vscode.window.createWebviewPanel(
      viewType,
      title,
      previewColumn,
      {
        // Enable javascript in the webview
        enableScripts: true,

        // And restrict the webview to only loading content from our extension's `media` directory.
        localResourceRoots: [
          vscode.Uri.file(path.join(this.extensionPath, 'media'))
        ]
      }
    );

    panel.title = title;
    panel.webview.html = await this.getHtmlForWebview(panel.webview);
    // panel.onDidChangeViewState
    // panel.webview.onDidReceiveMessage
  }

  private async getHtmlForWebview(webview: vscode.Webview) {
    const dynamicWebServerPort = 3000;
    const fullWebServerUri = await vscode.env.asExternalUri(
      vscode.Uri.parse(`http://localhost:${dynamicWebServerPort}`)
    );
    // Local path to main script run in the webview
    const scriptPathOnDisk = vscode.Uri.file(
      // path.join(this._extensionPath, 'media', 'main.js')
      path.join(this.extensionPath, 'media', 'index.js')
    );

    // And the uri we use to load this script in the webview
    const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">

                <!--
                Use a content security policy to only allow loading images from https or from our extension directory,
                and only allow scripts that have a specific nonce.
                -->
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src https://online.visualstudio.com ${fullWebServerUri}; img-src ${
      webview.cspSource
    } https:; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">

                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Cat Coding</title>
            </head>
            <body style="height: 100vh; background: white">
                <!--<h1 id="lines-of-code-counter">0</h1>-->

                <iframe src="${fullWebServerUri}" style="border: none; width: 100%; height: 100%;">

                <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
            </body>
            </html>`;
  }

  private getNonce() {
    let text = '';
    const possible =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
export const webviewService = new WebviewService();

// function getHtmlForWebview() {
//   const dynamicWebServerPort = 3000;
//   const nonce = getNonce();
