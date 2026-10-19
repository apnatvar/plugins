# Chrome Web Store listing

## Product details

- **Name:** Prompt Composer
- **Category:** Productivity
- **Language:** English
- **Homepage:** https://brownsmithdynamics.com
- **Support:** https://brownsmithdynamics.com
- **Publisher:** Brownsmith Dynamics

## Summary

Review, format and reuse prompt snippets beside compatible editors across the web.

## Detailed description

Prompt Composer adds a compact prompt toolbar beside compatible editors. Review a draft for actionable problems, convert it to a clearer output format, or insert a reusable snippet.

Key features:

- Review prompts for ambiguity, missing context, conflicting instructions, sensitive-looking values, and other practical issues.
- Expand each review problem to see a possible solution.
- Format drafts as plain text, Markdown, JSON, or YAML.
- Insert ready-made or personal snippets from the editor toolbar.
- Add, edit, duplicate, enable, disable, and delete snippets in the side panel.
- Preview changes before replacing the editor text, then undo the most recent replacement.
- Configure extension behavior globally or by website hostname.

Prompt Composer is enabled by default for a curated list of popular AI editors, including ChatGPT, Claude, Gemini, Perplexity, Meshy, Sarvam, Grok, Copilot, Poe, DeepSeek, Mistral and Meta AI. Users can add or remove hostnames or enable all websites.

Prompt text is read only from the focused supported editor while you use the extension. Draft text is not stored or transmitted. Settings and snippet definitions are stored locally in Chrome and can be changed or removed at any time.

Tools by Brownsmith Dynamics: https://brownsmithdynamics.com

## Single purpose

Prompt Composer helps users review, format, and reuse prompt text beside compatible editors across the web.

## Permissions justification

- **storage:** Stores extension settings and snippet definitions locally in `chrome.storage.local`.
- **sidePanel:** Provides the interface for managing snippets, website access, settings, and privacy information.
- **Host access:** Makes the toolbar available beside compatible editors on user-allowed HTTP and HTTPS websites. The extension starts with a curated hostname allowlist; users can add or remove websites or explicitly enable all websites.

The extension does not request tabs, history, identity, clipboard-read, or downloads access.

## Privacy dashboard answers

- **Does the extension collect or use user data?** It handles user-provided prompt text transiently and locally to provide the requested feature. It stores user-created snippet definitions and extension settings locally.
- **Personal communications:** Prompt text may contain user-authored communications, but it is neither collected by the publisher nor transmitted.
- **Website content:** The focused editor text is read only while the user invokes extension features. It is processed locally and is not persisted.
- **User activity:** Not collected.
- **Authentication information:** Not collected.
- **Location, financial, health, or browsing history data:** Not collected.
- **Analytics, advertising, or personalization:** None.
- **Sale, sharing, or transfer:** None.

Certification text: Prompt Composer's handling of information received from browser permissions complies with the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Listing assets

- Store icon: `store-assets/listing/icon-128.png`
- Main screenshot: `store-assets/listing/screenshot-toolbar-1280x800.png`
- Small promotional tile: `store-assets/listing/promo-small-440x280.png`
- Marquee promotional tile: `store-assets/listing/promo-marquee-1400x560.png`
- Large logo: `store-assets/listing/logo-512.png`
- Privacy policy source: `store-assets/PRIVACY_POLICY.md`

## Submission checklist

1. Run `pnpm zip` and upload `apps/extension/.output/prompt-composer-0.2.3-chrome.zip`.
2. Upload the 128 px icon and at least the 1280 x 800 screenshot.
3. Add the promotional tiles if desired.
4. Paste the summary, detailed description, single-purpose statement, and permission explanations above.
5. Publish `PRIVACY_POLICY.md` at a public HTTPS URL and enter that URL in the privacy section.
6. Complete the privacy practices disclosure and certify the Limited Use statement.
7. Verify the developer account and two-step verification requirements.
8. Choose visibility and distribution, then submit for review.
