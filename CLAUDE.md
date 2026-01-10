# Claude Instructions

## Quality Gate

**Do NOT stop until all affected tests, lints, builds and typechecks pass.** DO writeback any failures and lessons learned along the way to documentation!

## NO MOCK DATA RULE

**CRITICAL: NEVER use mock/hardcoded event data that users will see.**

All events displayed to users MUST come from real API sources (Eventbrite, etc.).
This includes:
- Search results
- Event listings
- Calendar views
- Any user-facing event display

If no results are found, show an appropriate "no results" message - NOT fake events.

This rule exists because:
1. Users trust our data is real
2. Mock data creates false expectations
3. It's confusing when "events" don't actually exist

**Enforcement**: Before any PR that touches event display code, verify no mock/hardcoded events are shown to users.
