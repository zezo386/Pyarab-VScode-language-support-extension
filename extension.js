const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

function activate(context) {
    // Command to set interpreter path
    let setPathCommand = vscode.commands.registerCommand('pyarab.setInterpreterPath', async () => {
        const fileUris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            openLabel: 'Select pyarab.py',
            filters: {
                'Python files': ['py'],
                'All files': ['*']
            },
            title: 'Select PyArab Interpreter (pyarab.py)'
        });

        if (fileUris && fileUris.length > 0) {
            const selectedPath = fileUris[0].fsPath;
            
            // Save to workspace settings
            const config = vscode.workspace.getConfiguration('pyarab');
            await config.update('interpreterPath', selectedPath, vscode.ConfigurationTarget.Workspace);
            
            vscode.window.showInformationMessage(`PyArab interpreter set to: ${selectedPath}`);
            
            // Test if it works
            const testResult = await testInterpreter(selectedPath);
            if (testResult.success) {
                vscode.window.showInformationMessage('✓ Interpreter test successful!');
            } else {
                vscode.window.showWarningMessage(`Interpreter test failed: ${testResult.error}`);
            }
        }
    });

    // Main run command
    let runCommand = vscode.commands.registerCommand('pyarab.runFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found!');
            return;
        }

        const document = editor.document;
        const filePath = document.fileName;
        
        if (!filePath.endsWith('.pyarab')) {
            vscode.window.showErrorMessage('This is not a .pyarab file!');
            return;
        }

        // Get interpreter path from settings
        const config = vscode.workspace.getConfiguration('pyarab');
        let interpreterPath = config.get('interpreterPath');

        // If no interpreter set, ask user to set it
        if (!interpreterPath || !fs.existsSync(interpreterPath)) {
            const choice = await vscode.window.showWarningMessage(
                'PyArab interpreter not configured!',
                'Set Interpreter Path',
                'Cancel'
            );
            
            if (choice === 'Set Interpreter Path') {
                await vscode.commands.executeCommand('pyarab.setInterpreterPath');
                // Try again after setting
                interpreterPath = config.get('interpreterPath');
                
                if (!interpreterPath || !fs.existsSync(interpreterPath)) {
                    return; // User cancelled or didn't set it
                }
            } else {
                return; // User cancelled
            }
        }

        // Verify interpreter exists
        if (!fs.existsSync(interpreterPath)) {
            vscode.window.showErrorMessage(
                `Interpreter not found: ${interpreterPath}\n` +
                'Please set the correct path using: "PyArab: Set Interpreter Path"'
            );
            return;
        }

        // Run the file in terminal
        const terminal = vscode.window.createTerminal({
            name: 'PyArab Runner',
            iconPath: vscode.Uri.file(context.asAbsolutePath('images/logo.png'))
        });

        terminal.show();
        
        // Change to file's directory
        const fileDir = path.dirname(filePath);
        const fileName = path.basename(filePath);
        
        terminal.sendText(`cd "${fileDir}"`);
        
        // Run the command
        const command = `python "${interpreterPath}" "${fileName}"`;
        terminal.sendText(command);
        
        vscode.window.showInformationMessage(`Running ${fileName} with interpreter: ${path.basename(interpreterPath)}`);
    });

    context.subscriptions.push(setPathCommand, runCommand);
}

async function testInterpreter(interpreterPath) {
    return new Promise((resolve) => {
        const { exec } = require('child_process');
        const testCommand = `python "${interpreterPath}" --help`;
        
        exec(testCommand, { timeout: 5000 }, (error, stdout, stderr) => {
            if (error) {
                // Try without --help flag (just run with no args)
                exec(`python "${interpreterPath}"`, { timeout: 5000 }, (error2) => {
                    if (error2) {
                        resolve({ 
                            success: false, 
                            error: 'Cannot execute interpreter' 
                        });
                    } else {
                        resolve({ success: true });
                    }
                });
            } else {
                resolve({ success: true });
            }
        });
    });
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};