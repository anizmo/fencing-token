# Security

Fencing Token is a static website and a curated reading list. It has no servers, accounts, forms, or user data.

## Reporting a problem

If you find a security issue with fencingtoken.com or this repository (for example a malicious or hijacked link in the roadmap, or a problem with the site itself), please report it privately via [GitHub's private vulnerability reporting](https://github.com/anizmo/fencing-token/security/advisories/new) rather than opening a public issue.

Broken or outdated links that are not a security risk can go in a normal [issue](https://github.com/anizmo/fencing-token/issues/new/choose).

## What the site does

- Static HTML, CSS, and one small script for the checklist and filter. No cookies; checklist ticks are stored only in your browser.
- Cookieless page-view counts via Cloudflare Web Analytics. No personal data, no ad trackers.
- A Content Security Policy limits scripts to this site and Cloudflare's analytics beacon.
