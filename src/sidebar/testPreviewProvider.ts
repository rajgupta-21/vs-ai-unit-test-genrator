import * as vscode from "vscode";

export class TestPreviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "ai-test-generator.preview";

  private view?: vscode.WebviewView;

  private pendingResult?: any;

  constructor() {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = `
    
    <html>
    <body>

    <h3>
      AI Generated Tests
    </h3>


    <pre id="output">
Waiting...
    </pre>


    <script>

    window.addEventListener(
      "message",
      event => {

        const data = event.data;


        if(data.command === "update"){

          document
          .getElementById("output")
          .textContent = data.content;

        }

      }
    );


    </script>


    </body>
    </html>
    `;

    // send old result if available
    if (this.pendingResult) {
      this.sendResult(this.pendingResult);
    }
  }

  update(result: any) {
    console.log("update called", result);

    this.pendingResult = result;

    if (!this.view) {
      console.log("Webview not opened yet");

      return;
    }

    this.sendResult(result);
  }

  private sendResult(result: any) {
    console.log("sending to webview:", result.tests);

    this.view?.webview.postMessage({
      command: "update",

      content: result.tests,
    });
  }
}
