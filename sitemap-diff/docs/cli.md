# Command-line reference

The package installs the `sitemap-diff` command. It compares two UTF-8 XML files, `.gz` files, or HTTP(S) sitemap URLs and writes a JSON report by default.

```sh
sitemap-diff before.xml after.xml
sitemap-diff before.xml.gz after.xml.gz --format markdown --output report.md
sitemap-diff https://www.example.com/sitemap.xml https://preview.example.com/sitemap.xml --format markdown
```

Run `sitemap-diff --help` to see the usage text. Current options:

| Option | Behavior |
| --- | --- |
| `--format json\|markdown` | Select output format. Default: `json`. |
| `--output PATH` | Write the report as UTF-8 to a local file. Without this option, print to stdout. |
| `--timeout-ms N` | Set the per-remote-document timeout. Default: 10,000 ms. |
| `--max-bytes N` | Set the raw and expanded per-document limit. Default: 5 MiB. |
| `--max-depth N` | Set sitemap-index recursion depth. Default: 5. |
| `--allow-private-networks` | Allow local/private destinations. Use only for trusted URLs. |
| `--help` | Print help and exit. |
| `--` | Treat remaining arguments as paths, even if they begin with `--`. |

The CLI reads local files itself and passes their contents to the library. A `.gz` suffix enables gzip decoding for local files. HTTP(S) URLs use the library's checked retrieval. Sitemap-index child references are followed under the library defaults; normal page URLs in `urlset` documents are not requested. The CLI has no option to disable private-network protections except the explicit `--allow-private-networks` opt-in.

When processing untrusted URLs, keep private-network access disabled. Use a separate network sandbox or outbound allowlist for higher-risk environments. See the [security assessment](security-assessment.md).
