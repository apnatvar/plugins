# Local XML example

The two XML files here are synthetic and use the reserved `example.com` hostname. They do not require or make network requests.

From the `sitemap-diff` project directory, build the package and run:

```sh
npm run build
node examples/compare.mjs
```

The comparison uses the default fragment-stripping behavior. It reports one added URL, one removed URL, one metadata change for `/guide/`, and one extra duplicate entry for `/new-page/` on the after side. The example prints JSON and Markdown forms of the same result.
