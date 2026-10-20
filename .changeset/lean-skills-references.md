---
"@fission-ai/openspec": minor
---

Generated skills are shorter. Each `SKILL.md` keeps the steps every run needs, and detail only some runs need (store selection, an uninitialized project, example conversations, REMOVED and RENAMED checks, retiring a spec) moves into a `references/` folder beside it that the agent reads when a step sends it there. Command files carry the same text inline. Archive and bulk archive now let `openspec archive` merge, validate, and move each change instead of reproducing those steps by hand. Run `openspec update` to refresh installed skills.
