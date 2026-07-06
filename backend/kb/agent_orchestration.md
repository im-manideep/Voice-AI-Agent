---
topic: agent_orchestration
source: concept-notes
---

# Agent Orchestration & LangGraph

## Workflows vs agents

The core architectural split: workflows are systems where the control flow is
written in code — the LLM fills in steps, but code decides what happens next.
Agents are systems where the LLM itself decides the control flow — which tool
to call, whether to loop, when to stop. Workflows are predictable, testable,
and debuggable; agents are flexible but compound their own errors. The
practical rule: use the simplest structure that works, push every decision
that can be deterministic into code, and reserve LLM-driven control flow for
steps that genuinely need judgment.

## LangGraph's model: state, nodes, edges

LangGraph models an application as a graph over a shared, typed state (a
TypedDict or Pydantic model). Nodes are functions that receive the current
state and return a partial update; reducers define how updates merge — for
example, a messages list annotated with an "append" reducer accumulates
conversation history instead of overwriting it. Edges connect nodes: normal
edges are fixed transitions, while conditional edges call a routing function
on the state and return the name of the next node — this is how branching,
loops, and "should we call a tool or answer?" decisions are expressed in
code rather than left to chance.

## Checkpointing and persistence

A checkpointer persists the graph's state after each node execution, keyed by
a thread id. This gives three things at once: resumability (a crashed or
interrupted run continues from the last checkpoint rather than restarting),
multi-turn memory (the same thread id reloads prior state across requests),
and time travel (inspect or fork from any historical checkpoint when
debugging). Backends range from in-memory for tests to SQLite for local apps
and Postgres in production. Without a checkpointer, interrupts and
human-in-the-loop are impossible — there is nothing durable to resume from.

## Interrupts and human-in-the-loop

LangGraph supports pausing a run for human input. Static interrupts
(interrupt_before / interrupt_after on a node) always pause at that node —
the classic use is gating a dangerous tool call on human approval. Dynamic
interrupts (the interrupt() function inside a node) pause conditionally with
a payload describing what is being asked. Because state is checkpointed, the
graph can wait indefinitely; the client later resumes with a Command carrying
the human's decision (approve, edit, reject), and execution continues from
the paused node — not from the beginning. This is the standard pattern for
approval flows: the agent drafts an action, a human approves it, the graph
executes it.

## Multi-agent patterns and failure modes

Common topologies: a supervisor that routes tasks to specialist agents and
merges results; a pipeline where each agent's output feeds the next;
hierarchical teams for larger systems. The supervisor pattern keeps control
centralized and debuggable. Failure modes to design against: unbounded loops
(cap iterations in the routing logic), state bloat (messages growing until
context overflows — summarize or trim in a node), agents silently swallowing
tool errors (surface errors into state so routing can react), and putting
policy in prompts that belongs in edges — if a rule must always hold, encode
it as a conditional edge, not as an instruction the model might ignore.
