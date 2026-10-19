# Manual verification

Run these checks in the Extension Development Host after building with `npm run build` and pressing **F5**. This is a checklist; these steps have not been reported as executed.

1. Open a JSX file and run **Copy Editor: Open** from the Command Palette. Confirm the panel shows the active component's supported literal text, grouped under its source file with a line label for each field.
2. Add a local imported component in a second JSX or TSX file. Reopen Copy Editor and confirm text from both files appears in static traversal order, with separate file groups and line labels matching each source. Include two components from the same file and confirm both appear in that file group.
3. Edit text containing characters such as `&`, `<`, `>`, `{`, `}`, quotes, and non-ASCII text. Select **Save Changes** and confirm the JSX source remains valid and the intended text is preserved.
4. Use VS Code Undo after saving. Confirm the source edits are reverted across the affected files.
5. Open Copy Editor, then change one of its source ranges in the editor before saving the panel. Select **Save Changes** and confirm the extension rejects the stale edit safely.
6. Save a successful panel edit and confirm the panel fields refresh automatically. Close and reopen Copy Editor and confirm it extracts the current source again.
