---
date: 2026-01-12T03:26:26Z
researcher: Claude Code
git_commit: ed6773a
branch: main
repository: rig
topic: "Agentic Flow for Clarifying Questions and Search Architecture"
tags: [research, codebase, agents, search, event-sources, architecture]
status: complete
last_updated: 2026-01-11
last_updated_by: Claude Code
---

# Research: Agentic Flow for Clarifying Questions and Search Architecture

**Date**: 2026-01-12T03:26:26Z
**Researcher**: Claude Code
**Git Commit**: ed6773a
**Branch**: main
**Repository**: rig

## Research Question

How does the current agentic flow work for clarifying questions and search? Is it a tool call that fetches events? What's the difference between the current implementation and a proposed approach using multiple sub-agents that make multiple tool calls and collate data into a unified event format?

## Summary

**The current implementation does NOT use tool calls for event fetching.** The clarifying agent has no tools - it's purely conversational. When `ready_to_search=True`, the main API handler calls `search_events()` directly (not via agent tool). The search function then queries all enabled sources in parallel using `asyncio.gather()`.

**Key distinction from proposed approach:**
- **Current**: Single-agent conversation → direct function call → parallel async tasks
- **Proposed**: Orchestration agent → sub-agents making tool calls → unified collation

The unified `EventResult` format already exists and all sources convert to it before deduplication.

## Detailed Findings

### 1. Current Architecture: Two-Phase Flow

#### Phase 1: Clarifying Agent (Pure Conversation)

**Location**: `api/agents/clarifying.py:177-182`

```python
clarifying_agent = Agent(
    name="clarifying_agent",
    instructions=get_clarifying_instructions,
    output_type=AgentTurnResponse,
    model="gpt-4o",
)
```

**Critical observation**: The clarifying agent has **NO tools** defined. It relies purely on LLM reasoning with structured output.

**What it does**:
1. Gathers time range (REQUIRED) and user interests through conversation
2. Converts relative time expressions ("this weekend") to ISO datetimes
3. Sets `ready_to_search=True` when sufficient info gathered
4. Populates `search_profile` with `SearchProfile` model

**Output model** (`api/models/conversation.py:15-35`):
```python
class AgentTurnResponse(BaseModel):
    message: str
    quick_picks: list[QuickPickOption] = []
    placeholder: str | None = None
    ready_to_search: bool = False
    search_profile: SearchProfile | None = None
```

#### Phase 2: Search (Direct Function Call, Not Tool)

**Location**: `api/index.py:220-233`

When `output.ready_to_search == True`:
```python
# Line 230: Send "searching" SSE event
yield sse_event("searching", {})

# Line 233: Direct function call (NOT a tool)
search_result = await search_events(output.search_profile)
```

**Critical observation**: `search_events()` is called directly from the API handler, NOT via an agent tool. There is a search agent defined (`api/agents/search.py`) but it's **not currently used**.

### 2. How Events Are Actually Fetched

**Location**: `api/agents/search.py:261-409`

The `search_events()` function:

1. **Gets enabled sources** from registry (line 274-275)
2. **Builds parallel tasks** for each source (line 289-295)
3. **Executes all sources in parallel** (line 311):
   ```python
   results = await asyncio.gather(*tasks, return_exceptions=True)
   ```
4. **Converts results** to unified `EventResult` format (line 334)
5. **Deduplicates** by URL and title (line 367)
6. **Returns** `SearchResult` with events

### 3. Event Source Registry Pattern

**Location**: `api/services/base.py:16-150`

Each source registers an adapter function:

| Source | Priority | Adapter Location |
|--------|----------|------------------|
| Eventbrite | 10 | `api/services/eventbrite.py:428-479` |
| Meetup | 15 | `api/services/meetup.py:298-371` |
| Exa | 20 | `api/services/exa_client.py:422-478` |
| Posh | 25 | `api/services/firecrawl.py:414-481` |
| Exa Research | 30 | `api/services/exa_research.py:156-202` |

Each adapter:
- Accepts `SearchProfile`
- Converts to source-specific parameters
- Calls source API
- Returns source-specific model (e.g., `EventbriteEvent`)

### 4. Unified Event Format (Already Exists)

**Location**: `api/agents/search.py:34-47`

```python
class EventResult(BaseModel):
    id: str
    title: str
    date: str  # ISO 8601
    location: str
    category: str
    description: str
    is_free: bool
    price_amount: int | None = None
    distance_miles: float
    url: str | None = None
```

Conversion functions exist for each source type:
- `_convert_eventbrite_event()` (line 77-94)
- `_convert_meetup_event()` (line 154-172)
- `_convert_exa_result()` (line 97-125)
- `_convert_scraped_event()` (line 128-151)

Dispatcher at `_convert_source_results()` (line 236-258) routes by source name and type.

### 5. Existing Search Agent (Unused)

**Location**: `api/agents/search.py:1-75`

A search agent IS defined with tools:
```python
# Tools defined:
# - search_events (function_tool)
# - refine_results (function_tool)
```

But this agent is **never invoked**. The `search_events()` function is called directly from `index.py`.

## Architecture Diagram: Current vs Proposed

### Current Flow

```
User Message
     ↓
┌─────────────────────────────┐
│     Clarifying Agent        │  (NO tools, pure conversation)
│     (gpt-4o)                │
└─────────────────────────────┘
     ↓ ready_to_search=True
     ↓ search_profile
┌─────────────────────────────┐
│   API Handler (index.py)    │  (Direct function call)
│   search_events(profile)    │
└─────────────────────────────┘
     ↓
┌─────────────────────────────┐
│   asyncio.gather(           │  (Parallel async tasks)
│     eventbrite_adapter(),   │
│     meetup_adapter(),       │
│     exa_adapter(),          │
│     posh_adapter(),         │
│   )                         │
└─────────────────────────────┘
     ↓
┌─────────────────────────────┐
│   _convert_source_results() │  (Unified format)
│   _deduplicate_events()     │
└─────────────────────────────┘
     ↓
SSE Stream → Frontend
```

### Proposed Flow (Sub-Agents with Tool Calls)

```
User Message
     ↓
┌─────────────────────────────┐
│   Orchestration Agent       │  (Coordinator)
└─────────────────────────────┘
     ↓ spawn sub-agents
┌──────────┬──────────┬──────────┬──────────┐
│ EB Agent │ MU Agent │ Exa Agent│ Posh Agt │
│ (tool)   │ (tool)   │ (tool)   │ (tool)   │
└──────────┴──────────┴──────────┴──────────┘
     ↓           ↓           ↓          ↓
  Events      Events      Events     Events
     ↓           ↓           ↓          ↓
┌─────────────────────────────────────────────┐
│   Collation Agent                           │
│   (Unify format, deduplicate, rank)         │
└─────────────────────────────────────────────┘
     ↓
Unified EventResult[]
     ↓
SSE Stream → Frontend
```

## Key Differences: Current vs Proposed

| Aspect | Current | Proposed |
|--------|---------|----------|
| **Search invocation** | Direct function call | Agent tool call |
| **Source queries** | `asyncio.gather()` | Sub-agents (parallel) |
| **Collation** | In-process conversion | Dedicated collation agent |
| **Error handling** | `return_exceptions=True` | Per-agent failure handling |
| **Result refinement** | Fixed dedup algorithm | LLM-powered ranking |
| **Extensibility** | Add adapter + register | Add sub-agent |
| **Conversation context** | Lost after clarifying | Preserved in orchestrator |
| **Follow-up queries** | Start over | Orchestrator remembers |

## Benefits of Sub-Agent Approach

1. **Intelligent collation**: LLM can resolve conflicts (e.g., same event from two sources with different descriptions)

2. **Conversational refinement**: User can say "show me more like the first one" and orchestrator routes to appropriate sources

3. **Source-specific reasoning**: Each sub-agent can interpret source results (e.g., Exa returns web pages, needs extraction)

4. **Graceful degradation**: If one sub-agent fails, orchestrator explains and continues

5. **Dynamic source selection**: Orchestrator can decide which sources to query based on query type

## Trade-offs

| Proposed Benefit | Trade-off |
|------------------|-----------|
| LLM-powered collation | More API calls, higher latency |
| Conversational refinement | More complex state management |
| Per-source reasoning | N agents vs 1 agent cost |
| Dynamic selection | Need to encode source capabilities |

## Code References

- Clarifying agent: `api/agents/clarifying.py:177-182`
- Search function: `api/agents/search.py:261-409`
- Event registry: `api/services/base.py:47-124`
- EventResult model: `api/agents/search.py:34-47`
- Unused search agent: `api/agents/search.py:1-75`
- SSE streaming: `api/index.py:128-132`
- Conversion functions: `api/agents/search.py:77-172`
- Deduplication: `api/agents/search.py:175-233`

## Architecture Documentation

### Current Patterns

1. **Registry Pattern**: Sources self-register via `register_event_source()`
2. **Adapter Pattern**: Each source has an adapter converting `SearchProfile` to source-specific params
3. **Converter Pattern**: Each source type has a converter to unified `EventResult`
4. **SSE Streaming**: Real-time event delivery via Server-Sent Events

### Existing Infrastructure for Sub-Agent Approach

Already in place:
- `EventResult` unified format
- Source registration system
- Conversion functions per source
- Background task manager (for async Websets)

Would need:
- Sub-agent definitions per source
- Orchestration agent with tool calls
- Collation agent or enhanced orchestrator
- State management for follow-up queries

## Open Questions

1. Should the orchestrator also handle clarifying, or keep two-phase?
2. How to handle latency increase from sub-agent overhead?
3. Should collation be a separate agent or part of orchestrator?
4. How to preserve conversation context for refinement queries?
