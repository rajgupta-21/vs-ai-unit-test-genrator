import * as vscode from "vscode";

/*
  This class is a "WebviewViewProvider" — VS Code lets extensions create
  custom sidebar panels using HTML/CSS/JS inside a sandboxed iframe called
  a "Webview". This class manages that sidebar panel.
*/

export class TestPreviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "ai-test-generator.preview";

  // We store a reference to the webview so we can send messages to it later
  private view?: vscode.WebviewView;
  private isReady = false;

  // If AI result arrives before the sidebar is opened, we store it here
  // and send it once the sidebar opens
  private pendingResult?: any;

  // We need the extension context to get URIs for local assets (if needed)
  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this.getHtmlContent();

    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "ready":
          this.isReady = true;

          if (this.pendingResult) {
            this.sendResult(this.pendingResult);
            this.pendingResult = undefined;
          }

          break;

        case "copyTests":
          vscode.env.clipboard.writeText(message.content);

          vscode.window.showInformationMessage("Tests copied!");

          break;

        case "insertToFile":
          this.insertTestsToNewFile(message.content, message.language);

          break;

        case "openDiff":
          this.openDiffView(message.content, message.language);

          break;
      }
    });
  }

  update(result: any) {
    this.pendingResult = result;

    if (!this.view) {
      return;
    }

    this.sendResult(result);
  }

  // Send structured result to the webview via postMessage
  // Think of this like window.postMessage() in the browser
  private sendResult(result: any) {
    if (!this.isReady) {
      this.pendingResult = result;
      return;
    }

    this.view?.webview.postMessage({
      command: "update",
      tests: result.tests ?? "",
      language: result.language ?? "plaintext",
      framework: result.framework ?? "",
      analysis: result.analysis ?? "",
    });
  }

  // Show a loading spinner in the sidebar while AI is working
  showLoading() {
    this.view?.webview.postMessage({ command: "loading" });
  }

  // Show an error message inside the sidebar
  showError(message: string) {
    this.view?.webview.postMessage({ command: "error", message });
  }

  // Create a new untitled file with the generated tests
  private async insertTestsToNewFile(tests: string, language: string) {
    const doc = await vscode.workspace.openTextDocument({
      content: tests,
      language: language || "plaintext",
    });
    await vscode.window.showTextDocument(doc, { preview: false });
  }

  // Open a side-by-side diff view comparing original file with generated tests
  private async openDiffView(tests: string, language: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("No active editor to diff against.");
      return;
    }

    const doc = await vscode.workspace.openTextDocument({
      content: tests,
      language: language || editor.document.languageId,
    });

    await vscode.commands.executeCommand(
      "vscode.diff",
      editor.document.uri,
      doc.uri,
      `Original ↔ AI Tests`,
    );
  }

  // All the sidebar HTML lives here — kept in one method to keep extension.ts clean
  private getHtmlContent(): string {
    return String.raw`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>AI Test Generator</title>
  <style>
    /* VS Code exposes CSS variables like --vscode-editor-background 
       so our sidebar matches the user's theme automatically */
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      padding: 12px;
      height: 100vh;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .header-icon {
      font-size: 18px;
    }

    .header-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--vscode-foreground);
    }

    /* ── Metadata badges (Language / Framework) ── */
    .meta-row {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .badge {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 3px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      font-weight: 500;
    }

    /* ── Analysis box (AI's reasoning) ── */
    .analysis-box {
      background: var(--vscode-textBlockQuote-background);
      border-left: 3px solid var(--vscode-activityBarBadge-background);
      padding: 8px 10px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      border-radius: 2px;
      display: none; /* hidden until result arrives */
    }

    .analysis-box.visible {
      display: block;
    }

    /* ── Code block ── */
    .code-wrapper {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
    }

    .code-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 10px;
      background: var(--vscode-editorGroupHeader-tabsBackground);
      border-bottom: 1px solid var(--vscode-panel-border);
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    pre {
      flex: 1;
      overflow: auto;
      padding: 12px;
      font-family: var(--vscode-editor-font-family), monospace;
      font-size: var(--vscode-editor-font-size, 12px);
      line-height: 1.6;
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      white-space: pre-wrap;
      word-break: break-word;
    }

    /* ── Action buttons ── */
    .actions {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    button {
      width: 100%;
      padding: 7px 12px;
      border: none;
      border-radius: 3px;
      font-size: 12px;
      cursor: pointer;
      font-family: var(--vscode-font-family);
      transition: opacity 0.15s;
    }

    button:hover {
      opacity: 0.85;
    }

    button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    /* ── Empty / Loading / Error states ── */
    .state-box {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      text-align: center;
      padding: 20px;
    }

    .state-icon {
      font-size: 32px;
    }

    .spinner {
      width: 24px;
      height: 24px;
      border: 3px solid var(--vscode-panel-border);
      border-top-color: var(--vscode-activityBarBadge-background);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error-text {
      color: var(--vscode-errorForeground);
    }

    /* hide/show sections */
    .hidden { display: none !important; }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <span class="header-icon">🧪</span>
    <span class="header-title">AI Unit Test Generator</span>
  </div>

  <!-- Empty state (default) -->
  <div class="state-box" id="emptyState">
    <div class="state-icon">⚡</div>
    <div>
      Select a function in your editor<br/>then run <strong>Generate Unit Tests</strong>
    </div>
  </div>

  <!-- Loading state -->
  <div class="state-box hidden" id="loadingState">
    <div class="spinner"></div>
    <div>Generating tests with AI...</div>
  </div>

  <!-- Error state -->
  <div class="state-box hidden" id="errorState">
    <div class="state-icon">⚠️</div>
    <div class="error-text" id="errorText">Something went wrong.</div>
  </div>

  <!-- Result state (shown after AI responds) -->
  <div id="resultSection" class="hidden" style="display:flex;flex-direction:column;gap:10px;flex:1;overflow:hidden;">

    <!-- Language + Framework badges -->
    <div class="meta-row">
      <span class="badge" id="langBadge"></span>
      <span class="badge" id="fwBadge"></span>
    </div>

    <!-- AI Analysis / reasoning -->
    <div class="analysis-box" id="analysisBox"></div>

    <!-- Generated code -->
    <div class="code-wrapper">
      <div class="code-toolbar">
        <span>Generated Tests</span>
        <span id="lineCount"></span>
      </div>
      <pre id="codeOutput"></pre>
    </div>

    <!-- Action buttons -->
    <div class="actions">
      <button class="btn-primary" id="btnCopy">📋 Copy to Clipboard</button>
      <button class="btn-secondary" id="btnInsert">📄 Open in New File</button>
      <button class="btn-secondary" id="btnDiff">↔ View as Diff</button>
    </div>

  </div>

  <script>
  console.log("🔥 WEBVIEW STARTED");


const vscodeApi = acquireVsCodeApi();

  console.log("WEBVIEW SCRIPT LOADED");
    // ── State ──────────────────────────────────────────────────────────────
    let currentTests = "";
    let currentLanguage = "";

    // Grab elements once
    const emptyState   = document.getElementById("emptyState");
    const loadingState = document.getElementById("loadingState");
    const errorState   = document.getElementById("errorState");
    const resultSection = document.getElementById("resultSection");
    const codeOutput   = document.getElementById("codeOutput");
    const langBadge    = document.getElementById("langBadge");
    const fwBadge      = document.getElementById("fwBadge");
    const analysisBox  = document.getElementById("analysisBox");
    const lineCount    = document.getElementById("lineCount");
    const errorText    = document.getElementById("errorText");

    // ── Show/hide helpers ──────────────────────────────────────────────────
    function showOnly(id) {
      [emptyState, loadingState, errorState, resultSection].forEach(el => {
        el.classList.add("hidden");
        // resultSection uses flex; we manage it separately
        if (el.id === "resultSection") el.style.display = "none";
      });

      const target = document.getElementById(id);
      target.classList.remove("hidden");
      if (id === "resultSection") target.style.display = "flex";
    }

    // ── Receive messages from the extension (TypeScript side) ─────────────
    // VS Code uses postMessage() to communicate between extension and webview
    window.addEventListener("message", (event) => {
      const data = event.data;
      console.log("event.data",event.data);

      if (data.command === "loading") {
        showOnly("loadingState");
        return;
      }

      if (data.command === "error") {
        errorText.textContent = data.message || "Something went wrong.";
        showOnly("errorState");
        return;
      }

      if (data.command === "update") {
        currentTests = data.tests || "";
        currentLanguage = data.language || "plaintext";

        // Show language & framework badges
        langBadge.textContent = data.language || "Unknown";
        fwBadge.textContent   = data.framework || "";
        fwBadge.style.display = data.framework ? "inline" : "none";

        // Show AI analysis if present
        if (data.analysis) {
          analysisBox.textContent = data.analysis;
          analysisBox.classList.add("visible");
        } else {
          analysisBox.classList.remove("visible");
        }

        // Show generated code
        codeOutput.textContent = currentTests;

        // Show line count
        const lines = currentTests.split("\n").length;
        lineCount.textContent = lines + " lines";

        showOnly("resultSection");
      }
    });



    document.getElementById("btnCopy").addEventListener("click", () => {
      vscodeApi.postMessage({ command: "copyTests", content: currentTests });
    });

    document.getElementById("btnInsert").addEventListener("click", () => {
      vscodeApi.postMessage({
        command: "insertToFile",
        content: currentTests,
        language: currentLanguage,
      });
    });

    document.getElementById("btnDiff").addEventListener("click", () => {
      vscodeApi.postMessage({
        command: "openDiff",
        content: currentTests,
        language: currentLanguage,
      });
    });
vscodeApi.postMessage({
  command:"ready"
});
  </script>
</body>
</html>`;
  }
}
