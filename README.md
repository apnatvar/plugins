# Brownsmith Dynamics Plugins

A growing collection of browser extensions, editor extensions, and related tools by [Brownsmith Dynamics](https://brownsmithdynamics.com).

The projects now live together in this single Git repository. Each tool has its own directory, documentation, and development workflow. More plugins and supporting resources will be added over time; the current collection is a starting point.

## Explore Brownsmith Dynamics

- **[Main website — brownsmithdynamics.com](https://brownsmithdynamics.com):** the original Brownsmith Dynamics site, with business services, products, and contact information.
- **[Plugins — plugins.brownsmithdynamics.com](https://plugins.brownsmithdynamics.com):** the public plugins hub, with product guides, privacy policies, and support information.
- **[MCP — mcp.brownsmithdynamics.com](https://mcp.brownsmithdynamics.com):** the Brownsmith Dynamics Business Advisor and Model Context Protocol (MCP) connection information.

## Current tools

| Tool | Platform | What it does | Source and setup |
| --- | --- | --- | --- |
| Page QR | Chrome | Turns the current page URL into a QR code that you can scan, download, or copy. | [page-qr](page-qr/README.md) |
| PPDF · Privacy PDF by [BD] | Chrome | Compresses JPEG images inside PDFs and merges, splits, organises, numbers, and creates PDFs entirely offline. | [ppdf](ppdf/README.md) |
| Prompt Composer | Chrome | Helps review, format, and reuse prompts in compatible web editors, with previews and local snippets. | [prompt-enhancer](prompt-enhancer/README.md) |
| JSX Copy Editor | VS Code | Edits literal JSX and TSX copy in a panel grouped by source file, with source line labels. | [jsx-copy-editor](jsx-copy-editor/README.md) |

Prompt Composer's source directory is named `prompt-enhancer`. Visit the [plugins hub](https://plugins.brownsmithdynamics.com) for product information and availability, and follow each tool's README for local installation or development.

## Work with the repository

Clone the collection once:

```sh
git clone https://github.com/apnatvar/plugins.git
cd plugins
```

Then open the directory for the tool you want to use or change:

- **Page QR:** load `page-qr/` as an unpacked Chrome extension. No build step is required.
- **PPDF:** open `ppdf/`, run `npm ci` and `npm run build`, then load `ppdf/dist/` as an unpacked Chrome extension.
- **Prompt Composer:** open `prompt-enhancer/` and follow its Node.js and pnpm setup instructions.
- **JSX Copy Editor:** open `jsx-copy-editor/` and follow its npm build and VS Code development instructions.

There is no shared root install or build command. Dependencies, build outputs, checks, and packaging are managed within each project.

## Adding more tools

Add each new tool in its own directory with a README covering its purpose, supported platform, setup, development commands, and privacy behavior. Keep generated packages, dependencies, and credentials out of source control. Update the table above as the collection grows, and keep public guides and policies on the plugins hub aligned with the tool's behavior.

## Support

For plugin help, visit [plugins support](https://plugins.brownsmithdynamics.com/support/). For enquiries, visit [Brownsmith Dynamics](https://brownsmithdynamics.com/contact) or email [contact@brownsmithdynamics.com](mailto:contact@brownsmithdynamics.com).
