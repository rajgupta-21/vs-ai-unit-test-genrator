import * as vscode from "vscode";
import { genrateUnitTest } from "./service/ai.service";
import { TestPreviewProvider } from "./sidebar/testPreviewProvider";

export function activate(context: vscode.ExtensionContext) {
  console.log('extension "test-case-generator-ai" is now active!');

  const provider = new TestPreviewProvider();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      TestPreviewProvider.viewType,
      provider,
    ),
  );

  const disposable = vscode.commands.registerCommand(
    "test-case-generator-ai.helloWorld",
    async () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showErrorMessage("No active editor found");

        return;
      }

      const selectedText = editor.document.getText(editor.selection);

      if (!selectedText.trim()) {
        vscode.window.showWarningMessage(
          "Please select a function or code first",
        );

        return;
      }

      const entireText = editor.document.getText();

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,

          title: "Generating unit tests with AI...",
        },

        async () => {
          try {
            const responseFromAI = await genrateUnitTest(
              selectedText,
              entireText,
            );

            if (!responseFromAI) {
              vscode.window.showErrorMessage(
                "AI did not generate any response",
              );

              return;
            }

            provider.update(responseFromAI);

            const generatedDocument = await vscode.workspace.openTextDocument({
              content: responseFromAI,

              language: editor.document.languageId,
            });

            await vscode.commands.executeCommand(
              "vscode.diff",

              editor.document.uri,

              generatedDocument.uri,

              "AI Generated Tests",
            );

            vscode.window.showInformationMessage(
              "Unit tests generated successfully",
            );
          } catch (error) {
            console.error("AI generation error:", error);

            vscode.window.showErrorMessage("Failed generating tests");
          }
        },
      );
    },
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
