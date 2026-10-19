# JSX Copy Editor

A lightweight VS Code extension by [Brownsmith Dynamics](https://brownsmithdynamics.com) for editing literal JSX and TSX copy in one panel, grouped by source file with line numbers.

## After installation

1. Open a local `.jsx` or `.tsx` file in VS Code.
2. Press **Ctrl+Shift+P** (Mac: **Cmd+Shift+P**) and run **Copy Editor: Open**.
3. Review one block per source file. Each field shows the line where its text begins.
4. Edit the fields and click **Save Changes**, then save the source files normally.

Imported components appear in their own file blocks. You do not need to run your website or development server.

## Use in development

1. Run `npm install` in this directory.
2. Run `npm run build`.
3. Open this project in VS Code and press **F5** to launch the Extension Development Host.
4. Open a JSX or TSX file, open the Command Palette, and run **Copy Editor: Open**.
5. Edit the displayed text fields and select **Save Changes** to apply them to the source files.

Changes are applied to the VS Code document buffers through a workspace edit and support normal undo. Save the files in VS Code as usual. Copy Editor refreshes its fields after a successful save; close and reopen it to start from a fresh extraction. Stale source selections are rejected before an edit is applied.

## Scope

The panel presents literal JSX text from the active component and supported local components. File groups follow their first encounter during static traversal; fields keep their traversal order within each file. This is not browser DOM order. Multiple components in one source file are supported, while repeated source entries appear once. Dynamic expressions, props, maps, conditionals, template content and attribute values are outside the supported scope. Complex imports and ambiguous components are skipped.

## Development commands

- `npm install` installs dependencies.
- `npm run build` builds the extension.
- Press **F5** in VS Code to debug it in an Extension Development Host.
- `npm test` runs the project tests.
- `npm run package` builds a VSIX package for local installation or review.

## Privacy

JSX Copy Editor processes source locally in VS Code. It has no backend, AI service, network calls, telemetry or configuration modifications. For support, email [contact@brownsmithdynamics.com](mailto:contact@brownsmithdynamics.com) or visit [brownsmithdynamics.com](https://brownsmithdynamics.com).
