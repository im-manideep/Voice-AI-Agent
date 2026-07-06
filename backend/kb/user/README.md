# Your own study content goes here

Drop markdown files (e.g. your four project READMEs: MCP server, offline LLM
app, RAG + evals, multi-agent) into this folder and restart the backend.

Each file must start with YAML frontmatter assigning it a topic id from
`backend/topics.json`:

```
---
topic: mcp_basics
source: my-mcp-server-readme
---
```

Files without a valid `topic` are **skipped with a warning** in the server
logs (this README is ignored automatically).
