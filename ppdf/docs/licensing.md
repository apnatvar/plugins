# Licensing and bundled software

PPDF does not bundle Ghostscript. Its [licensing terms](https://ghostscript.com/licensing/) and [FAQ](https://ghostscript.com/faq/) describe its AGPL and commercial licensing options.

The production build reads `package-lock.json`, copies licence and notice files for production dependencies into `dist/licenses/`, and writes `dist/licenses/inventory.json`. The package step includes those files in the downloadable archive. `THIRD_PARTY_LICENSES.md` is generated from the same inventory during `npm run build` and summarizes package names, versions, and declared licences.

See the generated [third-party licence inventory](../THIRD_PARTY_LICENSES.md) after building the project.
