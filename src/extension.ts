import * as vscode from "vscode";
import { genrateUnitTest } from "./service/ai.service";
import { TestPreviewProvider } from "./sidebar/testPreviewProvider";

export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "test-case-generator-ai" is now active!');

  // Pass extensionUri so the provider can reference local assets if needed
  const provider = new TestPreviewProvider(context.extensionUri);

  // Register our custom sidebar panel
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      TestPreviewProvider.viewType,
      provider,
      {
        // Keep the webview alive even when it's hidden (don't destroy + re-create)
        // This means the sidebar remembers its last result when you switch tabs
        webviewOptions: { retainContextWhenHidden: true },
      },
    ),
  );

  // Register the "Generate Unit Tests" command
  // This is what gets triggered from the Command Palette or a keybinding
  const generateCommand = vscode.commands.registerCommand(
    "test-case-generator-ai.generateTests",
    async () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showErrorMessage("No active editor found.");
        return;
      }

      const selectedText = editor.document.getText(editor.selection);

      if (!selectedText.trim()) {
        vscode.window.showWarningMessage(
          "Please select a function or code block first.",
        );
        return;
      }

      // Tell the sidebar to show a loading spinner
      provider.showLoading();

      const entireFileText = editor.document.getText();

      // withProgress shows a small notification with a spinner at the bottom right
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Generating unit tests with AI...",
          cancellable: false,
        },
        async () => {
          try {
            const result = await genrateUnitTest(selectedText, entireFileText);

            if (!result) {
              provider.showError("AI did not return a response. Try again.");
              vscode.window.showErrorMessage("AI did not generate a response.");
              return;
            }

            provider.update(result);

            await vscode.commands.executeCommand(
              "ai-test-generator.preview.focus",
            );

            await new Promise((resolve) => setTimeout(resolve, 500));

            provider.update(result);

            vscode.window.showInformationMessage("✅ Unit tests generated!");
          } catch (error) {
            console.error("AI generation error:", error);
            provider.showError("Failed to generate tests. Check your API key.");
            vscode.window.showErrorMessage(
              "Failed to generate tests. Check the console for details.",
            );
          }
        },
      );
    },
  );

  context.subscriptions.push(generateCommand);
}

export function deactivate() {}
