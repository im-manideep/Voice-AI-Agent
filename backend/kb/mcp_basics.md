---
topic: mcp_basics
source: concept-notes
---

# MCP Basics

## What MCP is

The Model Context Protocol (MCP) is an open standard that connects AI
applications to external tools and data through one common protocol. Before
MCP, every assistant integrated every tool with bespoke glue code — an M×N
problem: M applications times N integrations. MCP turns it into M+N: a tool is
wrapped once as an MCP server, and any MCP-capable client (Claude Desktop,
IDEs, custom agents) can use it. The protocol is JSON-RPC 2.0 under the hood,
with a capability negotiation handshake at connection time.

## The three primitives

An MCP server can expose three kinds of capabilities. Tools are functions the
model decides to call — each has a name, a description, and a JSON Schema for
its inputs; the model picks tools the way it picks any function call, so the
description quality directly drives correct usage. Resources are read-only
data identified by URIs — files, database rows, API responses — that the
client application (not the model) chooses to attach as context. Prompts are
reusable, parameterized templates the user invokes explicitly (slash-command
style). The division of control is the point: tools are model-controlled,
resources are application-controlled, prompts are user-controlled.

## Architecture and transports

Three roles: the host application embeds an MCP client; the client maintains a
1:1 connection to each MCP server; servers expose capabilities. Two standard
transports: stdio — the client launches the server as a local subprocess and
speaks JSON-RPC over stdin/stdout, ideal for local tools with zero network
setup — and streamable HTTP for remote servers, which supports authentication
(OAuth) and multiple concurrent clients. A local dev server is usually stdio;
a shared company server is HTTP.

## Building a good server

Typical build (Python or TypeScript SDK): define each tool with a precise
docstring/description and a strict input schema, return structured results,
and keep tools narrow — one clear capability per tool beats one mega-tool with
a mode parameter. Descriptions are prompt engineering: the model reads them to
decide when and how to call the tool, so vague descriptions produce wrong
calls. Validate inputs server-side anyway — schemas constrain shape, not
semantics. Log every call with its arguments for debugging, and return errors
as informative messages the model can act on, not opaque stack traces.

## Security and operational pitfalls

MCP's power is its risk surface: servers execute with real permissions.
Watch for: prompt injection through tool results (a fetched webpage or file
can contain instructions the model may follow — treat tool output as
untrusted data), overly broad tools (a run_shell_command tool hands the model
your machine), missing authorization on HTTP servers, and supply-chain risk
from installing third-party servers (they run with your credentials). Best
practice is least privilege — scope tokens narrowly, require human approval
for destructive operations, and never put secrets in tool descriptions or
results, because everything the server returns can end up in the model's
context and its logs.
