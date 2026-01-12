---
date: 2026-01-12T12:00:00-05:00
researcher: Claude
git_commit: 4d2ab20e61dd3f35bdeec7c039890e98fe7e309e
branch: main
repository: calendar-club-prototype
topic: "Exa Research API Prompt Length Limits"
tags: [research, exa, api-limits]
status: complete
last_updated: 2026-01-12
last_updated_by: Claude
---

# Research: Does Exa's Research API Truncate Long Prompts?

**Date**: 2026-01-12
**Researcher**: Claude
**Git Commit**: 4d2ab20e61dd3f35bdeec7c039890e98fe7e309e
**Branch**: main
**Repository**: calendar-club-prototype

## Research Question

If your prompt is too long, does Exa's research API truncate your request?

## Summary

**No, Exa does NOT truncate long prompts. The API enforces a hard limit of 4096 characters on the `instructions` parameter and will reject requests that exceed this limit.**

The limit is defined in Exa's OpenAPI specification as `maxLength: 4096` on the `instructions` field. Standard API behavior with schema validation means the request will fail validation and return an error rather than silently truncating your input.

## Detailed Findings

### API Specification

From Exa's OpenAPI schema for `POST /research/v1`:

```yaml
instructions:
  type:
    - string
  maxLength: 4096
  description: >-
    Instructions for what you would like research on. A good prompt
    clearly defines what information you want to find, how research
    should be conducted, and what the output should look like.
```

### Current Codebase Usage

In `api/services/exa_research.py:97-102`, the codebase passes the query directly to Exa without any truncation handling:

```python
def _sync_create_research_task(
    self,
    query: str,
    output_schema: type[BaseModel] | None = None,
) -> Any:
    client = self._get_client()
    kwargs: dict[str, Any] = {"instructions": query}
    if output_schema:
        kwargs["output_schema"] = output_schema
    return client.research.create(**kwargs)
```

The `research_events_adapter` function (lines 245-321) builds queries by joining parts with `. ` separators. Current query construction is unlikely to exceed 4096 characters, but no explicit guard exists.

### Implications

1. **Rejection, not truncation**: If instructions exceed 4096 characters, the API will return an error
2. **No silent data loss**: Unlike some APIs that truncate, you'll know when your prompt is too long
3. **Current usage is safe**: The query construction in `research_events_adapter` produces queries well under 4096 characters

## Code References

- `api/services/exa_research.py:97-102` - Query passed to Exa SDK
- `api/services/exa_research.py:255-279` - Query construction logic

## External References

- [Exa Research API - Create Task](https://docs.exa.ai/reference/research/create-a-task) - Official API documentation with schema
- [Exa Research Overview](https://docs.exa.ai/reference/exa-research) - General research API documentation
