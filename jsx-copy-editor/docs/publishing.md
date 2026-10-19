# Publish JSX Copy Editor to the VS Code Marketplace

The easiest first release is a browser upload of the ready-made `.vsix` file.
This guide follows Microsoft's [publishing documentation](https://code.visualstudio.com/api/working-with-extensions/publishing-extension).

## 1. Try the updated extension

In VS Code, press **Ctrl+Shift+P**, choose **Extensions: Install from VSIX…**,
and select `jsx-copy-editor-1.0.1.vsix` from this project folder. Reload VS Code
if asked. Open a `.tsx` file, then run **Copy Editor: Open**.

You should see one section per source file, with a line number above each field.
Make a small edit, click **Save Changes**, and save the source file normally.
You can now use the extension in regular VS Code without F5.

## 2. Create your publisher account

Open [Marketplace publisher management](https://marketplace.visualstudio.com/manage/publishers/)
and sign in with your Microsoft account. Choose **Create publisher**.

- Display name: **Brownsmith Dynamics**.
- Publisher ID: **brownsmith-dynamics** (confirmed by the project owner).
- Website: **https://brownsmithdynamics.com**.
- Support email: **contact@brownsmithdynamics.com**.

The ID must match the `publisher` field in this project's `package.json`, which
is `brownsmith-dynamics`. The identifier was confirmed by the project owner;
Marketplace account status has not been independently verified here.

## 3. Use the packaged release

The prepared upload is `jsx-copy-editor-1.0.1.vsix`. It includes the icon,
description, README, creator website, support email, and extension code.

If you changed the publisher ID or any files, open a terminal in this project
and run:

```powershell
npm run package
```

This rebuilds the VSIX. You do not upload the source folder or a ZIP.

## 4. Upload and publish

In publisher management, choose your publisher, then **New extension → Visual
Studio Code**. Upload the VSIX. Review the name, icon, description, website and
contact details. Complete any required fields and choose **Publish**.

The README supplies the main Marketplace description; the package supplies
the short description and icon. You do not need a terminal access token for
this manual browser-upload route.

## 5. Confirm it is available

Wait for Marketplace validation, then open the listing. In a normal VS Code
window, search Extensions for **JSX Copy Editor** by **Brownsmith Dynamics**.
Install it and run **Copy Editor: Open** on a local JSX or TSX file.

If validation reports a problem, retain its exact message so it can be fixed.
The Marketplace determines when the listing becomes available.

## 6. Publish the matching docs site

The [guide](https://plugins.brownsmithdynamics.com/jsx-copy-editor/) and
[privacy policy](https://plugins.brownsmithdynamics.com/jsx-copy-editor/privacy/)
are now published. Once the Marketplace listing is available, supply its actual
URL so the site can link directly to it.

## Future updates

Increase `version` in `package.json`, rebuild the VSIX, and upload it through
the existing extension's update action. The Marketplace needs a new version
number for each release.

Reference: [Microsoft's extension manifest documentation](https://code.visualstudio.com/api/references/extension-manifest).
