# Manual site testing

Maintained by [Brownsmith Dynamics](https://brownsmithdynamics.com).

Public AI chat sites change frequently. The local fixture and adapter tests are the automated acceptance environment; this table must be updated after each authenticated manual pass. Do not record credentials or prompt contents.

The production default is a hostname allowlist. It includes ChatGPT, Claude, Gemini, Google AI Studio, Perplexity, Meshy, Sarvam, Grok, Copilot, Poe, DeepSeek, Mistral and Meta AI. Other websites must be added in Settings or enabled through the All websites option.

## Local loading status

- **Passed:** the production MV3 directory loaded without manifest errors in Playwright's bundled Chromium persistent context on 2026-07-14.
- **Passed:** all 11 automated local fixture scenarios, including textarea/contenteditable detection, dynamic lifecycle, verified replacement, cursor use, controlled input, privacy, settings, and custom snippets.
- **Not manually performed:** loading the directory through an installed Chrome profile's `chrome://extensions` UI. The exact steps are documented in the README; no personal browser profile was accessed.

| Site       | Editor detected     | Read draft          | Replace draft       | Cursor preserved    | Toolbar positioned  | SPA navigation      | Dark mode           | Known issues                                                                | Date tested |
| ---------- | ------------------- | ------------------- | ------------------- | ------------------- | ------------------- | ------------------- | ------------------- | --------------------------------------------------------------------------- | ----------- |
| ChatGPT    | Not manually tested | Not manually tested | Not manually tested | Not manually tested | Not manually tested | Not manually tested | Not manually tested | Live login was not automated. Selectors are covered by local fixtures only. | 2026-07-14  |
| Claude     | Not manually tested | Not manually tested | Not manually tested | Not manually tested | Not manually tested | Not manually tested | Not manually tested | Live login was not automated. Selectors are covered by local fixtures only. | 2026-07-14  |
| Gemini     | Not manually tested | Not manually tested | Not manually tested | Not manually tested | Not manually tested | Not manually tested | Not manually tested | Live login was not automated. Selectors are covered by local fixtures only. | 2026-07-14  |
| Perplexity | Not manually tested | Not manually tested | Not manually tested | Not manually tested | Not manually tested | Not manually tested | Not manually tested | Live login was not automated. Selectors are covered by local fixtures only. | 2026-07-14  |

## Procedure

1. Load the production unpacked extension from `apps/extension/.output/chrome-mv3`.
2. Open the site without sharing credentials or automating login.
3. Focus the primary prompt editor and verify exactly one toolbar appears.
4. Type non-sensitive sample text, open Review, and confirm local findings.
5. Open Snippets and confirm the final option opens the snippet manager side panel.
6. Preview a snippet, confirm the editor remains unchanged, then insert or replace it explicitly.
7. Navigate within the site's SPA and repeat editor detection.
8. Repeat in the site's light and dark themes and at 125%, 150%, and 200% zoom.
9. Record the date, result, and selector-related issues in the table.
