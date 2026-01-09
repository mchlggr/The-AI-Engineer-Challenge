## 0) Intake Confirmation and Scope Boundary

### Inputs received (assigned IDs)

| ID           | Input                                                   | One-line description                                                                                               |
| ------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **[DOC-1]**  | *API integration notes and ICS sync pattern*            | Practical API behaviors/rate limits (Eventbrite/Meetup/Luma) + emitting RFC 5545 VCALENDAR feeds.                  |
| **[DOC-2]**  | *Architecture for a deep event discovery agent*         | Official-first ingestion (Eventbrite/Meetup/Luma) + normalization/dedupe + ICS/CalDAV export patterns.             |
| **[DOC-3]**  | *Architecture for a Deep Event Research Agent*          | Eventbrite+Meetup+ICS ingestion, dedupe, recurrence handling, export, and CalDAV notes.                            |
| **[DOC-4]**  | *Blueprint for an End-to-End Events Agent*              | Multi-source aggregator blueprint: connectors → normalize → dedupe → rank → export; plus evaluation metrics.       |
| **[DOC-5]**  | *Building a Standard Event Schema*                      | iCalendar/CalDAV fundamentals, internal schema suggestions, and ICS correctness checklist.                         |
| **[DOC-6]**  | *Building Reliable Event Sync and Ranking*              | Google/Microsoft calendar webhook + delta sync patterns; ICS fallback; identity keys; privacy tips.                |
| **[DOC-7]**  | *Connectors, ICS, and ToS Boundaries*                   | Official APIs over scraping; Eventbrite ToS anti-scraping; standards overview; Google CalDAV mention.              |
| **[DOC-8]**  | *Deep‑Research Agent Architecture for Events*           | End-to-end pipeline + milestones (P0/P1/P2), enrichment, ranking features, export (ICS/CalDAV), privacy.           |
| **[DOC-9]**  | *Define canonical identities to merge duplicate events* | Canonical Event Identity (CEI) approach + matching thresholds + schema for clusters/instances.                     |
| **[DOC-10]** | *Designing a deep research agent for events*            | Eventbrite/Meetup/Ticketmaster ingestion, dedupe heuristics, ICS/CalDAV output, metrics + compliance notes.        |
| **[DOC-11]** | *Designing a Human Week‑View Calendar*                  | UI patterns for a more “human” week view (density cues, focus day, micro-interactions) + instrumentation hooks.    |
| **[DOC-12]** | *Designing intent graphs for event discovery*           | Intent-graph (node-by-intent) architecture; signal taxonomy; per-region config; LangGraph-style flow.              |
| **[DOC-13]** | *Designing Network Effects into Local Calendars*        | B2B2C growth loops: organizer incentives, zero-friction publishing, distribution flywheel, monetization sketch.    |
| **[DOC-14]** | *Embedding temporal reasoning into Calendar Club*       | Temporal parsing + LLM disambiguation + “date-vectors”/geo-vectors to resolve fuzzy date phrases.                  |
| **[DOC-15]** | *From Calendar Club to a Social Graph*                  | ClickHouse-based social graph (co-attendance) + “who to meet next” scoring and group suggestions.                  |
| **[DOC-16]** | *Key Event API Sources and Their Limits*                | Snapshot of Eventbrite/Meetup/Luma/Posh/LinkedIn access models + limits and restrictions.                          |
| **[DOC-17]** | *Latest API Updates for Event Platforms*                | Claims about platform-wide search removals (Eventbrite), Meetup GraphQL updates, Posh webhooks, River lacking API. |
| **[DOC-18]** | *Making Event Data Play Nicely Together*                | Narrative: official APIs + webhooks; normalize; timezone/recurrence; emit RFC-compliant ICS.                       |
| **[DOC-19]** | *Mapping a Living Event Graph with LangGraph*           | “Scenes” layer: emerging/steady/dormant labels, graph entities, scoring rules, storage + UI slices.                |
| **[DOC-20]** | *Mapping Event APIs and Calendar Sync Paths*            | Overview of event APIs + calendar publishing (ICS/webcal) + robots.txt standard + dedupe basics.                   |
| **[DOC-21]** | *Minimal Curate‑to‑Calendar Architecture*               | Minimal pipeline framing: fetch → normalize → serialize to ICS → publish via calendar APIs/CalDAV.                 |
| **[DOC-22]** | *Safe Polling and Ranking for Event Crawlers*           | Polite crawling: robots.txt (RFC 9309), 429/Retry-After handling, conditional requests, etiquette checklist.       |
| **[DOC-23]** | *Schema Patterns for Event Discovery Agents*            | Hybrid schema: strict facts + vibes JSONB + embeddings; Azure AI Search hybrid retrieval pattern.                  |
| **[DOC-24]** | *Source‑Aware RAG Strategy for Event Feeds*             | Provenance fields, per-source analytics, using source priors in ranking, audit log guidance.                       |
| **[DOC-25]** | *Sync and Safety for Event Data*                        | Compliance-first pipeline: normalize/dedupe/distribute; Eventbrite “no scraping” emphasis; ICS publishing notes.   |

### Hard constraints explicitly present in the inputs

These are **not assumptions**; they are repeated patterns and explicit guidance across the materials:

* **Official APIs first; scraping is risky / discouraged**; respect ToS + robots, and design for takedowns/provenance. ([DOC-7], [DOC-22], [DOC-25], [DOC-4])
* **Output interoperability requires RFC 5545 iCalendar correctness** (stable UID, DTSTAMP, folding, timezone handling, recurrence semantics). ([DOC-1], [DOC-5], [DOC-3], [DOC-6])
* **Rate limits and webhook/delta patterns matter operationally** (Eventbrite/Meetup/Luma quotas; Google/Microsoft webhook renewal; delta sync). ([DOC-1], [DOC-6], [DOC-2])
* **Deduplication/canonical identity is foundational** (CEI/cluster strategy; provenance retention). ([DOC-9], [DOC-4], [DOC-8], [DOC-24])

### Scope boundary (what this synthesis will and will not do)

* **Will do now:** normalize the provided inputs into comparable “product directions,” create a canonical taxonomy, compare options (scoring + feature matrices), lay out key trade-offs, propose archetypes, and deliver a PM decision survey.
* **Will not do yet:** generate a phased roadmap. Per your rules, roadmap requires PM survey answers + must-answer questions (Section 9 gate).

### Missing essentials needed later for a roadmap (flagged now; asked formally in Section 8)

* Target region(s) & initial vertical (Ohio/Columbus is mentioned, but not confirmed as requirement). ([DOC-4], [DOC-13], [DOC-19])
* Target customer (consumer vs organizer vs curator vs developer) and success metrics.
* Team capacity, timeline, platform surfaces (web/mobile), and compliance posture.
* Monetization constraints (only one doc sketches pricing). ([DOC-13])

---

## 1) Normalize Inputs into Comparable Product Cards

Below are **six distinct product/design “cards”** extracted by clustering the docs by **primary user + primary JTBD + primary system boundary**. Many docs contribute to the same card; I cite all relevant ones.

### Product Card P1 — Core Event Data Infrastructure (Ingest → Normalize → Dedupe → Provenance)

* **Name / label:** Core Event Graph & Canonical Store
* **Target users & primary JTBD:**

  * Primary: internal product/ops + downstream app features (search, feeds, notifications).
  * JTBD: “Maintain a clean, deduped, provenance-safe, queryable index of local events across sources.”
* **Core value proposition:** A trustworthy canonical event dataset that downstream experiences can rely on (feeds, discovery, sync).
* **Key features:**

  * Multi-source connectors (APIs first; optional crawlers/ICS ingestion) ([DOC-4], [DOC-8], [DOC-2], [DOC-10])
  * Normalization into a canonical event schema (timezones, price parsing, tags, geo) ([DOC-4], [DOC-8], [DOC-5])
  * Dedupe/cluster + merge policy + provenance retention ([DOC-9], [DOC-4], [DOC-8], [DOC-24])
  * Quality/completeness signals & evaluation dataset/metrics (P@20, NDCG, coverage, dup rate) ([DOC-4])
* **Differentiators (relative to “just a scraper”):**

  * Explainable identity (CEI) and provenance/takedown mechanics ([DOC-9], [DOC-4], [DOC-25])
  * Official-first + safety/crawl etiquette (robots, 429, conditional requests) ([DOC-7], [DOC-22])
* **UX / workflow notes:** Mostly backend/platform; UX manifests as “trustworthy events everywhere” rather than a UI. ([DOC-4], [DOC-8])
* **Data requirements & integrations:**

  * Event platforms: Eventbrite/Meetup/Luma/Ticketmaster/others where allowed ([DOC-2], [DOC-10], [DOC-16], [DOC-17])
  * Geo enrichment (geocoding + caching) ([DOC-4], [DOC-8])
* **Business model / pricing:** Not explicitly defined for this platform layer (unknown). (No direct pricing in [DOC-4]/[DOC-8].)
* **GTM / distribution assumptions:** Serves as a foundation for a consumer product or B2B integrations; not itself a wedge. (Inference; see “unknowns.”)
* **Technical approach / architecture:**

  * Pipeline: harvest → normalize → dedupe → enrich → rank → export ([DOC-8], [DOC-4])
  * Storage: Postgres + search index; optionally ClickHouse for analytics; pgvector/embeddings optional ([DOC-4], [DOC-15], [DOC-23])
* **Risks / constraints:**

  * ToS/legal constraints on scraping; must prioritize APIs, track provenance, support takedowns ([DOC-7], [DOC-25])
  * Operational complexity: rate limits, polling budgets, webhook ingestion, caching ([DOC-1], [DOC-8], [DOC-22])
* **Evidence notes:** [DOC-4], [DOC-8], [DOC-9], [DOC-22], [DOC-24], [DOC-25]

---

### Product Card P2 — Deep Event Discovery & Ranking Agent (Intent Graph + Hybrid Retrieval)

* **Name / label:** Discovery Agent + Relevance Engine
* **Target users & primary JTBD:**

  * Primary: end users searching for “the right events,” and curators producing feeds/digests.
  * JTBD: “Given my intent (topic/geo/time), surface high-quality, relevant events with explanations.”
* **Core value proposition:** Better-than-keyword discovery (hybrid text+vector, intent routing, temporal understanding).
* **Key features:**

  * Intent-graph pipeline (Collect → Normalize → Classify → Route → Dedupe → Enrich → GeoGate → Publish) ([DOC-12])
  * Hybrid retrieval model: strict facts + vibes JSONB + embeddings; BM25+vector+rerank pattern ([DOC-23], [DOC-4])
  * Ranking signals: freshness, proximity, completeness, organizer quality, diversity re-ranking ([DOC-8], [DOC-4], [DOC-24])
  * Source-aware ranking priors and per-source analytics ([DOC-24])
* **Differentiators:**

  * “Intent graph” architecture makes pipelines explainable + region-configurable ([DOC-12])
  * “Vibes” extraction layer enables qualitative matching beyond tags ([DOC-23])
* **UX / workflow notes:**

  * Query interface supports natural-language intent + filters; returns justifications (vibes.relevance_reason). ([DOC-23])
* **Data requirements & integrations:** Requires canonical event store (P1) as upstream or built-in. ([DOC-12], [DOC-23])
* **Business model / pricing:** Not specified (unknown), but can support consumer subscription or curator tooling.
* **GTM / distribution assumptions:** Works well with “weekly digest,” “niche feeds,” alerts, and partner widgets. ([DOC-13], [DOC-12]) *(Partner distribution is more explicit in P4; here it’s enabling.)*
* **Technical approach / architecture:**

  * Azure AI Search / OpenSearch hybrid + vector; Postgres for facts; extraction pipeline for vibes; reranker optional ([DOC-23], [DOC-4])
* **Risks / constraints:**

  * Model quality + evaluation burden; requires labeled set and monitoring ([DOC-4], [DOC-14])
  * Latency/cost trade-offs for embeddings/LLM extraction (implied by architecture; not explicitly costed)
* **Evidence notes:** [DOC-12], [DOC-23], [DOC-4], [DOC-8], [DOC-24]

---

### Product Card P3 — Calendar Sync & Publishing Service (ICS/webcal, CalDAV, Provider Webhooks)

* **Name / label:** Calendar Interop & Sync Layer
* **Target users & primary JTBD:**

  * Users: end-users who want events “in my calendar,” and integrators who need reliable sync.
  * JTBD: “Subscribe/import events reliably; keep them updated; avoid duplicates.”
* **Core value proposition:** “It just shows up correctly in Google/Apple/Outlook and stays updated.”
* **Key features:**

  * RFC 5545-compliant ICS feeds with stable UID/DTSTAMP/SEQUENCE correctness ([DOC-5], [DOC-6], [DOC-1])
  * webcal-style subscription UX (mentioned conceptually) ([DOC-5], [DOC-20])
  * Optional CalDAV server for bi-directional sync (P2 scope in some docs) ([DOC-3], [DOC-8], [DOC-5])
  * Provider webhooks + delta sync patterns (Google channels renewals; Microsoft Graph subscription renewals) ([DOC-6])
* **Differentiators:**

  * Correctness and reliability: renewal, delta sync, idempotency keyed by UID ([DOC-6], [DOC-5])
* **UX / workflow notes:** Subscription and trust: fewer duplicates, fewer wrong timezones, predictable updates.
* **Data requirements & integrations:**

  * Needs canonical event IDs and stable UIDs; depends on dedupe and identity (P1). ([DOC-5], [DOC-9], [DOC-6])
* **Business model / pricing:** Not specified (unknown).
* **GTM / distribution assumptions:** Works as a wedge (“Add by URL”, “Add to calendar”) to reduce habit friction. ([DOC-5], [DOC-13])
* **Technical approach / architecture:**

  * ICS feed endpoints with caching + ETags; webhook receivers; renewal scheduler; delta fetch workers ([DOC-6], [DOC-8])
* **Risks / constraints:**

  * Timezone/recurrence edge cases; client variance; CalDAV complexity (ETags, sync tokens) ([DOC-5], [DOC-3], [DOC-6])
* **Evidence notes:** [DOC-6], [DOC-5], [DOC-3], [DOC-8], [DOC-1]

---

### Product Card P4 — Organizer Publishing & Distribution Network (Network Effects)

* **Name / label:** “Publish Once, Reach Everywhere” Organizer Tooling
* **Target users & primary JTBD:**

  * Primary: event organizers/hosts; secondary: community partners (coworking spaces, libraries).
  * JTBD: “Publish an event with near-zero effort and get distribution + credibility + analytics.”
* **Core value proposition:** Turn event posting into a growth loop (status + reach + assets), not admin work.
* **Key features:**

  * Zero-friction import: paste URL → parse → prefill; bulk import (ICS/CSV/email-to-publish) ([DOC-13])
  * Distribution: syndicated feeds/digests/SMS/widgets; “Listed on Calendar Club” badge; verified organizer ([DOC-13])
  * Incentives: ranking boosts for richer metadata; referral links; recap loops; host reputation score ([DOC-13])
  * Monetization sketch: freemium + Pro Host subscription + sponsor lanes ([DOC-13])
* **Differentiators:**

  * Network effects via organizer incentives + distribution channels ([DOC-13])
* **UX / workflow notes:** Organizer dashboard, assets generation, and lightweight validation/guardrails. ([DOC-13])
* **Data requirements & integrations:**

  * Depends heavily on P1/P3 foundations (normalize, dedupe, feeds, compliance). (Inference grounded in dependencies implied by [DOC-13] distribution + [DOC-5]/[DOC-9] correctness requirements.)
* **Risks / constraints:**

  * Cold start: need distribution channels/users to make organizer value real
  * Trust & governance: spam prevention; norms enforcement affects ranking ([DOC-13])
* **Evidence notes:** [DOC-13] primarily; plus enabling dependencies [DOC-5], [DOC-9], [DOC-8]

---

### Product Card P5 — Social Graph & Scene Intelligence (Who-to-Meet, Emerging Scenes)

* **Name / label:** Event Social Layer (Graph + Scenes)
* **Target users & primary JTBD:**

  * Users: attendees looking for people/community; curators/ops wanting to understand “what’s emerging.”
  * JTBD: “Help me meet the right people and understand what’s happening in my local ecosystem.”
* **Core value proposition:** Transform events from listings into relationships, introductions, and scene dynamics.
* **Key features:**

  * Co-attendance graph + “who to meet next” ranking combining graph + topic vectors + freshness/locality ([DOC-15])
  * “Scenes” labeling (emerging/steady/dormant) with time-window velocity signals; UI slices like heatmaps/scene cards ([DOC-19])
* **Differentiators:** Network defensibility if adoption/participation grows; more defensible than pure aggregation. ([DOC-15], [DOC-19])
* **UX / workflow notes:** Explainability (“why recommended”) and privacy controls are critical. ([DOC-15])
* **Data requirements & integrations:**

  * Requires attendance/RSVP/check-in signals, or proxies; not fully specified how you obtain these reliably across platforms. (**Unknown**) ([DOC-15] outlines schema; sourcing is not detailed.)
* **Risks / constraints:**

  * Privacy/PII risk increases significantly; opt-outs and “do not suggest me to coworkers/competitors” mentioned conceptually ([DOC-15])
  * Data availability risk: many platforms won’t expose attendee identities via public APIs (not resolved in inputs; must validate)
* **Evidence notes:** [DOC-15], [DOC-19]

---

### Product Card P6 — Human Calendar UI (Week View Experience)

* **Name / label:** Human Week-View Calendar Client
* **Target users & primary JTBD:**

  * Primary: end users planning their week.
  * JTBD: “Scan my week fast, understand density/context, and take quick actions.”
* **Core value proposition:** Make the calendar grid read like a story, with contextual cues and low-friction interaction.
* **Key features:**

  * Visual cues: weekend shading, focus-day expansion, density bands, now marker, category stitches ([DOC-11])
  * Interactions: hover peek cards, focus mode, range scrub to create events; instrumentation hooks ([DOC-11])
* **Differentiators:** Craft quality + “feel” (but not inherently defensible without broader ecosystem).
* **Data requirements & integrations:** Needs events from P1/P2/P3 to be valuable beyond a personal calendar.
* **Risks / constraints:** UI polish can be expensive; must tie directly to retention outcomes (not quantified in inputs).
* **Evidence notes:** [DOC-11]

---

### Contradictions / gaps surfaced during normalization (explicit)

* **Eventbrite auth method is contradictory across inputs.**

  * OAuth 2.0 is repeatedly stated for Eventbrite ([DOC-1], [DOC-2], [DOC-7], [DOC-18]).
  * One doc claims “Auth via API key” for Eventbrite ([DOC-10]).
  * **Implication:** treat “Eventbrite via OAuth2 organizer-scoped APIs” as the safer baseline, but validate early.
* **Eventbrite rate limits differ between “docs” and “terms” per the inputs** (2,000/hr vs 1,000/hr/token). ([DOC-1])
* **Platform-wide “search all events” APIs may not exist (or be removed) on some platforms** (Eventbrite claim). ([DOC-17], [DOC-25])

  * **Implication:** “discovery” must rely on (a) organizer/partner access, (b) curated seed lists, (c) allowed crawls, (d) inbound submissions, rather than expecting universal APIs.

---

## 2) Canonical Feature & Topic Taxonomy

### Feature taxonomy (8 families)

1. **Source Connectivity**

   * Official API connectors (Eventbrite/Meetup/Luma/Ticketmaster/etc.)
   * Webhooks (source-side) + incremental fetch
   * ICS/RSS ingest
   * Scrape fallback (robots/ToS aware)
2. **Normalization & Data Model**

   * Canonical event schema, field mappings
   * Timezone resolution; price parsing; tag mapping
   * Enrichment (geocoding, organizer handles)
3. **Identity, Dedupe, and Provenance**

   * Canonical Event Identity (CEI) / clustering
   * Merge policy + source-of-truth rules
   * Provenance blobs + takedown support
4. **Indexing, Search, and Retrieval**

   * Facets/filters on facts
   * Hybrid retrieval (BM25 + vector)
   * “Vibes” extraction for qualitative matching
5. **Ranking & Personalization**

   * Relevance scoring (freshness, proximity, completeness)
   * Diversity/reranking
   * Source priors + learning loops
6. **Calendar Interop & Sync**

   * RFC 5545 ICS generation correctness
   * webcal-style subscription UX
   * CalDAV (optional) + bidirectional sync
   * Provider calendar webhooks/delta sync (Google/Microsoft)
7. **Publishing & Growth Loops**

   * Paste-a-URL publishing; bulk imports
   * Distribution channels (email/SMS/widgets)
   * Organizer reputation, referrals, recap loops
8. **Social & Insights**

   * Co-attendance / introductions
   * Scenes (emerging/steady/dormant)
   * Dashboards + analytics

### Topic taxonomy for trade-offs (10 topics)

* **Source strategy:** official APIs vs scraping vs inbound submissions
* **Sync model:** ICS subscription vs CalDAV vs push-to-calendar APIs
* **Identity strategy:** deterministic CEI vs ML/probabilistic entity resolution
* **Time handling:** deterministic temporal parsing vs LLM disambiguation
* **Ranking approach:** rules/BM25 vs embeddings/personalization
* **Product wedge:** consumer discovery vs organizer publishing vs curator tooling vs developer platform
* **Trust/compliance posture:** minimal PII vs social/attendance features
* **Ops model:** polling cadence vs webhooks vs hybrid budgets
* **Data architecture:** Postgres/search vs ClickHouse graph analytics
* **GTM motion:** self-serve viral loops vs partnerships vs enterprise sales

---

## 3) Comparative Evaluation

### 3A) Narrative: what each design optimizes for

* **P1 (Core Infrastructure)** optimizes for **data correctness, dedupe, provenance, and compliance** so every downstream feature works reliably. ([DOC-4], [DOC-9], [DOC-25])
* **P2 (Discovery Agent)** optimizes for **relevance**—matching user intent with hybrid retrieval, ranking signals, and explainable pipelines. ([DOC-12], [DOC-23], [DOC-8])
* **P3 (Calendar Sync Layer)** optimizes for **interop reliability**—stable UIDs, recurrence correctness, webhook renewals, delta sync, and minimal duplicates. ([DOC-6], [DOC-5])
* **P4 (Organizer Network)** optimizes for **network effects and distribution**—make publishing effortless and rewarding, monetize organizers, and compound value as more people participate. ([DOC-13])
* **P5 (Social Graph & Scenes)** optimizes for **defensibility and community intelligence**, but depends on access to attendance signals and stronger privacy posture. ([DOC-15], [DOC-19])
* **P6 (Calendar UI)** optimizes for **retention through craft**, but only differentiates meaningfully when paired with unique event supply and sync. ([DOC-11], [DOC-13])

### 3B) Scoring matrix (1–5)

**Legend:** 1 = weak/unfavorable; 3 = moderate; 5 = strong/favorable.

| Product                      | User value / outcome | Differentiation / defensibility | Feasibility (eng complexity) | Time-to-market | Cost to build & operate | Data/privacy/compliance risk | Adoption friction | Monetization clarity |
| ---------------------------- | -------------------: | ------------------------------: | ---------------------------: | -------------: | ----------------------: | ---------------------------: | ----------------: | -------------------: |
| **P1 Core Infrastructure**   |                    4 |                               2 |                            3 |              3 |                       2 |                            4 |                 3 |                    2 |
| **P2 Discovery Agent**       |                    4 |                               3 |                            3 |              3 |                       3 |                            3 |                 3 |                    2 |
| **P3 Calendar Sync Layer**   |                    4 |                               2 |                            3 |              4 |                       3 |                            4 |                 2 |                    2 |
| **P4 Organizer Network**     |                    5 |                               4 |                            3 |              3 |                       3 |                            3 |                 4 |                    4 |
| **P5 Social Graph & Scenes** |                    4 |                               5 |                            2 |              2 |                       2 |                            2 |                 4 |                    3 |
| **P6 Calendar UI**           |                    3 |                               2 |                            4 |              4 |                       3 |                            4 |                 3 |                    2 |

#### Score rationales (per product, concise, evidence-linked)

**P1 Core Infrastructure**

* **User value (4):** Enables trustworthy discovery/sync; dedupe + normalization are prerequisites for everything else. ([DOC-4], [DOC-8], [DOC-9])
* **Differentiation (2):** Foundational but not inherently defensible; many can build pipelines. (Inference; no explicit moat described in inputs beyond “do it right.”)
* **Feasibility (3):** Non-trivial but well-scoped blueprint exists (schema, dedupe, ops). ([DOC-4], [DOC-8])
* **Time-to-market (3):** MVP possible with limited sources + ICS export; still meaningful backend work. ([DOC-8] suggests P0 in weeks 1–2 for limited sources.)
* **Cost (2):** Ongoing ingestion, storage, enrichment, monitoring; multi-source ops adds burden. ([DOC-4], [DOC-22])
* **Risk (4):** If API-first and provenance-safe, compliance risk is manageable. ([DOC-7], [DOC-22], [DOC-25])
* **Adoption friction (3):** Internal platform; adoption depends on downstream product success. (Unknown externally.)
* **Monetization (2):** Not specified as a sellable product; monetization unclear in inputs. (Unknown.)

**P2 Discovery Agent**

* **User value (4):** Directly improves finding “the right events,” using intent graph + hybrid retrieval. ([DOC-12], [DOC-23])
* **Differentiation (3):** Intent-graph + vibes/embeddings can differentiate, but requires execution and data quality. ([DOC-12], [DOC-23])
* **Feasibility (3):** Straightforward architecture, but model evaluation and extraction pipelines add complexity. ([DOC-4], [DOC-23])
* **Time-to-market (3):** Can ship rules + minimal embeddings first; expand later. ([DOC-23], [DOC-12])
* **Cost (3):** Moderate compute/ops for embeddings + indexing + reranking; not fully quantified. ([DOC-23])
* **Risk (3):** Less legal risk than scraping, but can push toward ingesting richer data; manage with provenance. ([DOC-24], [DOC-7])
* **Adoption friction (3):** Similar to typical discovery products; needs distribution channel. (Unknown.)
* **Monetization (2):** Not specified; depends on chosen segment. (Unknown.)

**P3 Calendar Sync Layer**

* **User value (4):** “Add to calendar and it stays correct” is a strong retention utility if correctness is real. ([DOC-5], [DOC-6])
* **Differentiation (2):** More table-stakes; correctness is expected, not a wedge by itself. ([DOC-5])
* **Feasibility (3):** Complex edge cases (timezone/recurrence/webhook renewal), but known patterns exist. ([DOC-6], [DOC-3], [DOC-5])
* **Time-to-market (4):** Start with ICS feeds + stable UID; defer CalDAV; incremental improvements. ([DOC-5], [DOC-8])
* **Cost (3):** Manageable with caching/ETags; webhooks/delta sync adds ops but bounded. ([DOC-6])
* **Risk (4):** Compliance risk low (publishing user-facing calendars); main risk is correctness. ([DOC-5], [DOC-6])
* **Adoption friction (2):** ICS subscription is relatively low friction compared to full app switching. ([DOC-5], [DOC-20])
* **Monetization (2):** Not specified. (Unknown.)

**P4 Organizer Network**

* **User value (5):** Clear, explicit organizer benefits: auto-reach, assets, badges, analytics, referrals. ([DOC-13])
* **Differentiation (4):** Network effects + reputation loops + distribution compounding can be defensible. ([DOC-13])
* **Feasibility (3):** Requires both product + distribution ops + anti-spam governance; feasible but multi-disciplinary. ([DOC-13])
* **Time-to-market (3):** MVP can be paste-a-URL + weekly digest + add-to-calendar flows. ([DOC-13])
* **Cost (3):** Moderate; depends on distribution channels (SMS/email) and content ops. ([DOC-13])
* **Risk (3):** Spam/trust + content governance risks; less ToS risk if organizer-submitted. ([DOC-13], [DOC-25])
* **Adoption friction (4):** Organizers adopt if distribution is real; self-serve benefits; still requires proving ROI. ([DOC-13])
* **Monetization (4):** Only input with explicit pricing sketch (freemium + Pro Host + sponsors). ([DOC-13])

**P5 Social Graph & Scenes**

* **User value (4):** Potentially high (“who to meet next,” scene heatmaps) if data exists. ([DOC-15], [DOC-19])
* **Differentiation (5):** Graph effects can be highly defensible. ([DOC-15], [DOC-19])
* **Feasibility (2):** Major dependency on attendance/identity signals and privacy controls. ([DOC-15])
* **Time-to-market (2):** Hard to ship credibly without data pipelines and trust model. ([DOC-15])
* **Cost (2):** Graph computation + storage + privacy ops; unclear scale costs. ([DOC-15], [DOC-19])
* **Risk (2):** Higher privacy/PII exposure; strong policy requirements. ([DOC-15])
* **Adoption friction (4):** Requires users to engage/consent; cold start. (Inference.)
* **Monetization (3):** Could support premium/community sponsorships, but not specified concretely. (Mostly unknown.)

**P6 Calendar UI**

* **User value (3):** Useful UX improvements, but value depends on having differentiated event supply. ([DOC-11])
* **Differentiation (2):** UI polish alone is easy to copy. ([DOC-11])
* **Feasibility (4):** Implementable with standard frontend patterns. ([DOC-11])
* **Time-to-market (4):** Can ship UI iteration quickly. ([DOC-11])
* **Cost (3):** Moderate ongoing design/QA across devices/accessibility. (Inference.)
* **Risk (4):** Low compliance risk (UI layer). ([DOC-11])
* **Adoption friction (3):** Requires users to switch or adopt a new interface unless embedded. (Unknown.)
* **Monetization (2):** Not specified. (Unknown.)

---

## 4) Feature Comparisons in Both Orientations

### Canonical features used (18)

**Legend:** “—” = not supported, “P” = partially supported, “F” = fully supported, “*” = claimed but evidence/feasibility unclear from inputs.

#### Table 4.1a — Products × Features (Ingestion, Normalization, Identity)

| Product                      | (1) Official API connectors | (2) Webhook ingestion (source) | (3) Rate-limit & polite crawling | (4) Canonical event schema | (5) Geo/price/tag normalization | (6) CEI dedupe + provenance |
| ---------------------------- | --------------------------- | ------------------------------ | -------------------------------- | -------------------------- | ------------------------------- | --------------------------- |
| **P1 Core Infrastructure**   | F                           | P                              | F                                | F                          | F                               | F                           |
| **P2 Discovery Agent**       | P                           | P                              | P                                | F                          | P                               | P                           |
| **P3 Calendar Sync Layer**   | —                           | —                              | P                                | P                          | P                               | P                           |
| **P4 Organizer Network**     | P                           | —                              | P                                | P                          | P                               | P                           |
| **P5 Social Graph & Scenes** | P                           | P                              | P                                | P                          | P                               | P                           |
| **P6 Calendar UI**           | —                           | —                              | —                                | —                          | —                               | —                           |

**Evidence anchors:** connectors/official-first ([DOC-2], [DOC-4], [DOC-7], [DOC-10]); rate limits & crawl etiquette ([DOC-1], [DOC-22]); schema & normalization ([DOC-4], [DOC-5], [DOC-8]); CEI ([DOC-9], [DOC-24]).

#### Table 4.1b — Products × Features (Retrieval, Ranking, Temporal)

| Product                      | (7) Faceted search (time/geo/tags) | (8) Hybrid BM25+vector retrieval | (9) Quality/completeness ranking | (10) Source-aware priors/analytics | (11) Temporal phrase resolution | (12) Personalization/embeddings |
| ---------------------------- | ---------------------------------- | -------------------------------- | -------------------------------- | ---------------------------------- | ------------------------------- | ------------------------------- |
| **P1 Core Infrastructure**   | P                                  | P                                | P                                | P                                  | —                               | P                               |
| **P2 Discovery Agent**       | F                                  | F                                | F                                | F                                  | F                               | F                               |
| **P3 Calendar Sync Layer**   | —                                  | —                                | —                                | —                                  | —                               | —                               |
| **P4 Organizer Network**     | P                                  | P                                | P                                | P                                  | —                               | P                               |
| **P5 Social Graph & Scenes** | P                                  | P                                | P                                | P                                  | —                               | F                               |
| **P6 Calendar UI**           | P                                  | —                                | —                                | —                                  | —                               | —                               |

**Evidence anchors:** hybrid schema & retrieval ([DOC-23]); ranking & quality evaluation ([DOC-4], [DOC-8]); source-aware strategy ([DOC-24]); temporal reasoning ([DOC-14]); embeddings use across discovery/social ([DOC-15], [DOC-23], [DOC-8]).

#### Table 4.1c — Products × Features (Calendar Interop, Growth, Social, UI)

| Product                      | (13) RFC 5545 ICS feeds | (14) webcal subscribe UX | (15) CalDAV (2-way) | (16) Google/Microsoft webhook+delta sync | (17) Organizer publishing + distribution loops | (18) Social graph/scenes | (19) Human week-view UI |
| ---------------------------- | ----------------------- | ------------------------ | ------------------- | ---------------------------------------- | ---------------------------------------------- | ------------------------ | ----------------------- |
| **P1 Core Infrastructure**   | F                       | P                        | P                   | P                                        | P                                              | P                        | —                       |
| **P2 Discovery Agent**       | P                       | P                        | —                   | —                                        | P                                              | P                        | P                       |
| **P3 Calendar Sync Layer**   | F                       | F                        | P*                  | F                                        | —                                              | —                        | —                       |
| **P4 Organizer Network**     | F                       | F                        | —                   | —                                        | F                                              | P                        | P                       |
| **P5 Social Graph & Scenes** | P                       | P                        | —                   | —                                        | P                                              | F                        | P                       |
| **P6 Calendar UI**           | P                       | P                        | —                   | —                                        | —                                              | —                        | F                       |

**Evidence anchors:** ICS/CalDAV correctness ([DOC-5], [DOC-3], [DOC-8], [DOC-1]); Google/Microsoft sync ([DOC-6]); organizer loops + pricing ([DOC-13]); social graph/scenes ([DOC-15], [DOC-19]); week view UI ([DOC-11]).
*CalDAV is repeatedly described as “advanced / later” and operationally heavy ([DOC-3], [DOC-8]), so feasibility evidence is weaker than for ICS.

---

### Table 4.2 — Pivoted Feature View (Features × Products + Market Note)

| Feature (grouped)                | P1 Core Infra | P2 Discovery | P3 Sync | P4 Organizer | P5 Social | P6 UI | Competitive/Market Note                                                                                  |
| -------------------------------- | ------------- | ------------ | ------- | ------------ | --------- | ----- | -------------------------------------------------------------------------------------------------------- |
| **Source Connectivity**          |               |              |         |              |           |       |                                                                                                          |
| Official API connectors          | F             | P            | —       | P            | P         | —     | Table-stakes for compliant ingestion; “global search” often unavailable per inputs ([DOC-17], [DOC-25]). |
| Rate-limit & polite crawling     | F             | P            | P       | P            | P         | —     | Differentiator operationally (reliability) but not a user-facing moat ([DOC-22], [DOC-1]).               |
| **Normalization & Model**        |               |              |         |              |           |       |                                                                                                          |
| Canonical event schema           | F             | F            | P       | P            | P         | —     | Table-stakes to reduce downstream complexity ([DOC-4], [DOC-5]).                                         |
| Geo/price/tag normalization      | F             | P            | P       | P            | P         | —     | Becomes differentiating when used for ranking & feeds (quality). ([DOC-4], [DOC-8])                      |
| **Identity & Provenance**        |               |              |         |              |           |       |                                                                                                          |
| CEI dedupe + provenance          | F             | P            | P       | P            | P         | —     | Differentiator for trust; enables stable UIDs and takedowns ([DOC-9], [DOC-24], [DOC-25]).               |
| **Retrieval & Ranking**          |               |              |         |              |           |       |                                                                                                          |
| Hybrid BM25+vector               | P             | F            | —       | P            | P         | —     | Differentiating in discovery experiences ([DOC-23]).                                                     |
| Temporal phrase resolution       | —             | F            | —       | —            | —         | —     | Differentiator for “feels smart” discovery; but more complexity ([DOC-14]).                              |
| **Calendar Interop**             |               |              |         |              |           |       |                                                                                                          |
| RFC 5545 ICS feeds               | F             | P            | F       | F            | P         | P     | Table-stakes for calendar products; correctness is hard and valuable ([DOC-5], [DOC-6]).                 |
| CalDAV 2-way sync                | P             | —            | P*      | —            | —         | —     | Often “later”; complexity can outweigh benefits early ([DOC-8], [DOC-3]).                                |
| Provider calendar webhooks/delta | P             | —            | F       | —            | —         | —     | Reliability differentiator for true “sync,” more than static import ([DOC-6]).                           |
| **Publishing & Growth**          |               |              |         |              |           |       |                                                                                                          |
| Organizer publishing loops       | P             | P            | —       | F            | P         | —     | Clear differentiation + monetization path in inputs ([DOC-13]).                                          |
| **Social & Insights**            |               |              |         |              |           |       |                                                                                                          |
| Social graph / scenes            | P             | P            | —       | P            | F         | —     | High defensibility but highest privacy/data risk ([DOC-15], [DOC-19]).                                   |
| **UX**                           |               |              |         |              |           |       |                                                                                                          |
| Human week view UI               | —             | P            | —       | P            | P         | F     | Mostly table-stakes polish unless paired with unique supply ([DOC-11]).                                  |

---

## 5) Pivot Tables of Key Topics and Trade-offs

### Iteration A — Trade-offs by Topic (High-Level)

| Topic                  | Option 1 vs Option 2                                             | Who benefits / who loses                                                 | Evidence from inputs                                                                                                      | Implication for “Our Product” design                                                                        |
| ---------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Source strategy**    | **APIs-first** vs **scraping-first**                             | Benefits: reliability, ToS safety; Loses: breadth when APIs don’t exist  | APIs-first + ToS/robots emphasis ([DOC-7], [DOC-22], [DOC-25]); platform API limits and restrictions ([DOC-16], [DOC-17]) | Default to APIs + inbound submissions; keep scraping as last resort with explicit policies + provenance.    |
| **Discovery coverage** | **Curated seed lists + submissions** vs **“search everything”**  | Benefits: quality & compliance; Loses: immediate breadth                 | “No broad public search APIs” claim and organizer-scoped reality ([DOC-17], [DOC-25])                                     | Build supply through organizers/partners + curated feeds; don’t bet MVP on universal search endpoints.      |
| **Calendar output**    | **ICS/webcal feeds** vs **CalDAV 2-way**                         | Benefits: speed/simplicity vs advanced edit/sync                         | ICS correctness guidance ([DOC-5]); CalDAV described as advanced/heavier ([DOC-3], [DOC-8])                               | Ship ICS first; only add CalDAV when a clear bidirectional use case exists.                                 |
| **Sync correctness**   | **Stable UID + SEQUENCE discipline** vs **“best-effort import”** | Benefits: fewer duplicates, clean updates; Loses: more engineering rigor | UID/DTSTAMP/SEQUENCE requirements ([DOC-5], [DOC-6])                                                                      | Make stable UID + update semantics non-negotiable; test against Apple/Google/Outlook early.                 |
| **Identity/dedupe**    | **Deterministic CEI** vs **ML/learned entity resolution**        | Benefits: explainability vs potentially higher recall                    | CEI strategy + thresholds ([DOC-9]); deterministic merge policies ([DOC-4], [DOC-8])                                      | Start deterministic CEI + audit tooling; layer learned scoring later when you have labeled merges.          |
| **Ranking strategy**   | **BM25 + rules** vs **hybrid + embeddings**                      | Benefits: simplicity/cost vs relevance for fuzzy intent                  | Baseline BM25 + candidate reranker plan ([DOC-4]); hybrid schema & vector retrieval ([DOC-23])                            | MVP can ship rules/BM25; plan hybrid retrieval as V1 once data scale is adequate.                           |
| **Temporal reasoning** | **Deterministic parsers** vs **LLM disambiguation**              | Benefits: predictability vs better handling of fuzzy phrases             | Temporal-RAG design with deterministic-first then LLM ([DOC-14])                                                          | Implement deterministic parsing now; add LLM disambiguation behind confidence thresholds + eval set.        |
| **Product wedge**      | **Organizer-first** vs **Consumer-first**                        | Benefits: supply flywheel vs direct user demand                          | Organizer incentives + distribution loops + monetization sketch ([DOC-13])                                                | If you choose organizer-first, you must also build distribution surface (digest/SMS/widgets) early.         |
| **Trust & governance** | **Open submission** vs **Verified organizers + norms**           | Benefits: scale vs spam resistance                                       | Governance/norms and ranking penalties in organizer loop ([DOC-13])                                                       | Build verification tiers + spam controls early; incorporate into ranking/featuring.                         |
| **Privacy posture**    | **Minimal PII** vs **attendance/social graph**                   | Benefits: lower risk vs defensible social features                       | Privacy controls and opt-outs highlighted for social graph ([DOC-15]); minimize PII guidance ([DOC-8])                    | Defer PII-heavy graph features until consent and data sourcing are solved; keep privacy-by-design baseline. |

---

### Iteration B — Trade-offs by Segment/Persona (Pivot)

**Personas inferred from inputs (not explicitly provided as user research):**

1. **Event-goer** (wants relevant events + easy calendar integration)
2. **Organizer/Host** (wants distribution, credibility, analytics)
3. **Community Curator/Partner** (newsletter, coworking space, venue)
4. **Developer/Integrator** (wants clean APIs/feeds)

| Segment                  | Primary “wins”                            | Key trade-off preferences                                                                          | Evidence                                                                                                              | Implication for product                                                                               |
| ------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Event-goer**           | Relevance + low-friction subscribe        | Prefer: hybrid ranking + temporal resolution + ICS/webcal over CalDAV                              | Hybrid retrieval and temporal parsing focus ([DOC-23], [DOC-14]); ICS/webcal as low-friction path ([DOC-5], [DOC-20]) | Invest in P2+P3 experiences; make “Add to calendar” perfect; defer bidirectional edits.               |
| **Organizer/Host**       | Reach + status + ROI                      | Prefer: submission/paste-URL workflow + distribution loops + analytics; less concerned with CalDAV | Organizer loops and monetization are central ([DOC-13])                                                               | Organizer-first wedge implies building distribution channels and a credible badge/verification model. |
| **Curator/Partner**      | Trustworthy local feed + easy syndication | Prefer: APIs-first + provenance + stable feeds + filtering by niche/neighborhood                   | Provenance and per-region config patterns ([DOC-24], [DOC-12], [DOC-13])                                              | Ship embeddable widgets/feeds + curated collections; emphasize trust, freshness, and takedown safety. |
| **Developer/Integrator** | Correctness + predictable contracts       | Prefer: deterministic CEI + RFC-correct ICS + clear SLAs on rate limiting + deltas                 | CEI and RFC correctness emphasized ([DOC-9], [DOC-5], [DOC-6])                                                        | If selling B2B, documentation + reliability investments are required early; scope sources carefully.  |

---

### Iteration C — Trade-offs by Build Strategy (MVP vs V1 vs V2)

| Decision area         | MVP choice                                       | V1 choice                                     | V2 choice                                        | Dependencies / risk                                       | Evidence                                                         |
| --------------------- | ------------------------------------------------ | --------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------- |
| **Sources**           | 1–2 official sources + organizer submissions     | Add Meetup/Ticketmaster + selective scrapes   | Expand region-by-region with configs             | Coverage limited early; avoid “global search” assumptions | P0/P1 milestones ([DOC-8]); API landscape constraints ([DOC-17]) |
| **Output**            | ICS feeds + “Add by URL”                         | ICS + per-user collections + ETags            | CalDAV (only if needed)                          | CalDAV complexity high                                    | [DOC-5], [DOC-8], [DOC-3]                                        |
| **Identity**          | Deterministic CEI + simple thresholds            | CEI + human review queue for ambiguous merges | Learned merge scoring trained on audits          | Bad merges harm trust; need provenance & reversibility    | [DOC-9], [DOC-4], [DOC-24]                                       |
| **Ranking**           | Freshness + proximity + completeness             | Hybrid BM25+vector + source priors            | Reranker + personalization loops                 | Requires measurement + evaluation; cost control           | [DOC-4], [DOC-23], [DOC-24]                                      |
| **Temporal**          | Deterministic parser for “this weekend/next Thu” | Add LLM disambiguation for ambiguous cases    | Date-vectors + temporal ANN at scale             | Must build gold set & regression tests                    | [DOC-14]                                                         |
| **Organizer tooling** | Paste URL + basic listing + weekly digest        | Pro host analytics + referral links + assets  | Reputation system + partner distribution network | Needs distribution proof to acquire hosts                 | [DOC-13]                                                         |
| **Privacy**           | Minimal data retention; no attendee graph        | Opt-in signals + anonymized aggregates        | Social graph features with controls              | Highest risk area; data availability uncertain            | [DOC-15], [DOC-8]                                                |
| **Ops**               | Polling with budgets + rate-limit handling       | Webhooks where available; delta sync          | Advanced observability + per-source SLAs         | Renewal complexity, failure modes                         | [DOC-6], [DOC-22], [DOC-8]                                       |

---

## 6) Synthesis: Design Archetypes + Recommended Direction

### Archetype A — API-First Event Data & Feeds Platform

* **Positioning:** “The canonical, compliant event index + feeds that downstream apps can trust.”
* **Target user + JTBD:** Developers/curators: “Give me deduped, stable, RFC-correct event feeds.”
* **Core feature set:** connectors, normalization, CEI, provenance, ICS/webcal, basic search/filters. ([DOC-4], [DOC-5], [DOC-9], [DOC-24])
* **Differentiators:** correctness + provenance + ops reliability. ([DOC-22], [DOC-6])
* **Risks:** commoditization; unclear monetization in inputs.

### Archetype B — Consumer Discovery Calendar (Search → Subscribe → Plan)

* **Positioning:** “Find the right local events fast, and they appear in your calendar correctly.”
* **Target user + JTBD:** Event-goers: “Tell me what to do this week that matches my intent.”
* **Core feature set:** hybrid discovery, temporal resolution, quality ranking, calendar subscribe. ([DOC-23], [DOC-14], [DOC-5])
* **Differentiators:** relevance quality and UX, but requires supply/distribution.
* **Risks:** acquisition and retention not evidenced; competing against many discovery surfaces (not analyzed in inputs).

### Archetype C — Organizer-Led Distribution Network (B2B2C)

* **Positioning:** “Publish once, instantly reach the right local audiences across channels—plus earn credibility.”
* **Target user + JTBD:** Organizers/hosts: “Grow attendance with minimal effort; measure ROI.”
* **Core feature set:** paste-URL publishing, syndication, badge/verification, analytics, referrals, recap loops; backed by canonical data + ICS subscribe. ([DOC-13], [DOC-5], [DOC-9])
* **Differentiators:** network effects + aligned monetization (Pro Host, sponsor lanes). ([DOC-13])
* **Risks:** must prove distribution value; governance/spam control required.

### Archetype D — Community Social Graph & Scene Intelligence

* **Positioning:** “The local community operating system: discover scenes, meet people, and grow ecosystems.”
* **Target user + JTBD:** Power users/curators: “Help me find my people and understand what’s emerging.”
* **Core feature set:** co-attendance graph, intros, scene labels, heatmaps. ([DOC-15], [DOC-19])
* **Differentiators:** potentially strongest defensibility.
* **Risks:** privacy + data availability; long time-to-value.

### Recommended default direction: **Archetype C (Organizer-Led Distribution Network)**

**Rationale grounded in inputs:**

* It is the **only direction with explicit growth mechanics and a monetization sketch** (freemium + Pro Host + sponsors). ([DOC-13])
* It naturally avoids the “global event search API” constraint by focusing on **inbound submissions + syndication**, which the API landscape in the inputs suggests is necessary. ([DOC-17], [DOC-25], [DOC-13])
* It still leverages the strong technical foundation emphasized across the docs: **canonical schema, CEI, RFC-correct ICS**, which are prerequisites for credibility and distribution (“Add to calendar that works”). ([DOC-5], [DOC-9], [DOC-6])

**Critical caveat (unknown):** This recommendation assumes you can establish meaningful distribution channels (digest/SMS/partners) quickly enough to make organizer adoption rational. The inputs propose mechanisms but do not provide market evidence.

---

## 7) PM Survey (Multiple Choice, ABCD) + Recommended Answers

Each question maps to the archetypes and/or key trade-offs above.

### 1) Target segment / persona

A. Event-goers (consumer)
B. Organizers/hosts (B2B2C)
C. Curators/partners (B2B: widgets/feeds)
D. Developers/integrators (API product)

**Recommended: B**
Rationale: Organizer incentives + monetization + flywheel are most explicit in the inputs. ([DOC-13])

---

### 2) Primary JTBD

A. “Help me find relevant events fast.”
B. “Help me publish once and reach everywhere.”
C. “Help me sync everything reliably into calendars.”
D. “Help me understand community graphs/scenes.”

**Recommended: B**
Rationale: The most concrete differentiated value + loops are defined for organizer publishing. ([DOC-13])

---

### 3) Product wedge (initial use case)

A. Consumer “what’s happening this week” discovery page/app
B. Paste-a-URL organizer publisher with instant calendar feed + listing
C. API + embeddable widget for partners (coworking spaces, newsletters)
D. Social intros (“people you should meet next”) around events

**Recommended: B**
Rationale: Smallest coherent “organizer ROI” unit; aligns with suggested ship order. ([DOC-13])

---

### 4) Distribution / acquisition motion

A. Paid search + social to consumers
B. Partner syndication (coworking spaces, venues, libraries)
C. Organizer-led viral loops (badge, referral links, assets)
D. Enterprise/community ecosystem sales

**Recommended: C**
Rationale: Explicitly described incentive loops and referral mechanics. ([DOC-13])

---

### 5) Pricing model

A. Consumer subscription (premium discovery)
B. Organizer freemium → Pro Host subscription
C. Partner licensing (widgets/feeds)
D. Usage-based API pricing

**Recommended: B**
Rationale: The only pricing model outlined in the inputs. ([DOC-13])

---

### 6) Deployment / hosting model

A. Single-tenant enterprise deployments
B. Multi-tenant SaaS (hosted)
C. Self-hosted open source + paid cloud
D. “No backend” client-only app (thin server)

**Recommended: B**
Rationale: All architectures described assume centralized ingestion, indexing, and feed publishing. ([DOC-4], [DOC-8], [DOC-23])

---

### 7) Data strategy (collection, storage, retention)

A. Minimal retention (store only what’s needed for feeds; short-lived logs)
B. Canonical store + immutable provenance/audit log (moderate retention)
C. Full raw payload retention indefinitely for research
D. Attendance/identity graph data as a first-class dataset

**Recommended: B**
Rationale: Provenance + takedown + source-aware ranking repeatedly emphasized; but avoid PII-heavy graphs early. ([DOC-24], [DOC-4], [DOC-25], [DOC-15])

---

### 8) Differentiation strategy

A. Breadth of events (coverage)
B. Trust + correctness (dedupe, stable UID, updates that work)
C. AI magic (embeddings/LLM extraction)
D. Network effects (organizer incentives + distribution compounding)

**Recommended: D**
Rationale: This is the core of the organizer-led thesis; correctness remains necessary but not sufficient. ([DOC-13], [DOC-5])

---

### 9) Integrations strategy

A. Many source connectors early (maximize breadth)
B. Few connectors + strong inbound submission + curated seed lists
C. Focus on calendar providers (Google/Microsoft) integrations first
D. No integrations until product-market fit

**Recommended: B**
Rationale: Inputs warn that broad “search” APIs may be unavailable; organizer submission + curated configs are practical. ([DOC-17], [DOC-12], [DOC-13])

---

### 10) AI/automation strategy

A. No AI in MVP; rules only
B. Embeddings for retrieval + lightweight “vibes” extraction
C. LLM-first deep research agent for enrichment and ranking
D. Temporal-RAG (temporal resolution) as the main AI wedge

**Recommended: B**
Rationale: Hybrid schema pattern is pragmatic; defers higher-risk LLM disambiguation to later. ([DOC-23], [DOC-14])

---

### 11) Collaboration vs single-player workflow

A. Single organizer workflow only
B. Organizer + team collaboration (roles, co-hosts)
C. Community curator workflow (review queue, editorial calendar)
D. Social/attendee collaboration (invite friends, group plans)

**Recommended: C**
Rationale: Governance/quality is central to keeping feeds trustworthy; editorial workflow aligns with norms/ranking controls. ([DOC-13], [DOC-4], [DOC-24])

---

### 12) Compliance posture / risk tolerance

A. Strict APIs-only, no scraping ever
B. APIs-first + limited scraping where allowed by robots/ToS, with provenance
C. Scrape-first if needed for coverage
D. “Move fast” and address later

**Recommended: B**
Rationale: Inputs emphasize APIs-first and also provide “polite crawling” guidance; implement as a controlled, exception-based capability. ([DOC-7], [DOC-22], [DOC-4])

---

### 13) MVP scope boundary (what we explicitly will NOT do first)

A. No CalDAV / bidirectional sync in MVP
B. No attendance-based social graph features in MVP
C. No “global event search” promise in MVP
D. No multi-city expansion in MVP

**Recommended: B**
Rationale: Social graph raises privacy and data availability issues; defer until consent and sourcing are solved. ([DOC-15])
(Also, A and C are strong candidates; CalDAV is explicitly “advanced” in inputs, and global search is constrained by API landscape. ([DOC-8], [DOC-17]))

---

### Recommended Profile summary (implied by recommended answers)

If you follow the recommended answers, you are building:

* A **B2B2C organizer-led publishing and distribution product** (Archetype C),
* backed by a **canonical event store + provenance + CEI**,
* shipping **ICS/webcal subscription correctness early**,
* using **hybrid retrieval/embeddings selectively**,
* deferring **CalDAV** and **attendance/social graph** until later.
  Evidence threads: organizer flywheel + monetization ([DOC-13]) + correctness foundations ([DOC-5], [DOC-9], [DOC-6]) + compliance posture ([DOC-7], [DOC-22], [DOC-25]).

**Reply with your selected letters (e.g., 1B, 2D, 3A…).**

---

## 8) Follow-up Questions (Targeted, Prioritized)

### Group 1 — Must-answer to build roadmap (no roadmap until answered)

1. **Time horizon:** Are we planning a **6-month**, **12-month**, or **18-month** roadmap?
2. **Team capacity:** How many engineers/designers/PM/data roles do we have, and are they full-time on this?
3. **Initial geography:** Is the launch region **Columbus/Ohio** (implied in examples) or somewhere else? ([DOC-13], [DOC-19], [DOC-4])
4. **Primary customer:** Confirm your choice from the survey—who pays first: **organizers**, **partners**, **consumers**, or **developers**?
5. **Success metrics:** What are the top 3 metrics for the first 90 days post-launch (e.g., # published events/week, organizer activation, subscriber retention, RSVP/click-through)?
6. **Distribution channels you can actually use:** Do you already have (a) an email list, (b) SMS capability, (c) partner placements, (d) social distribution? Which are realistic at launch?
7. **Compliance posture:** Any non-negotiable requirements (e.g., “no scraping,” “no storing PII,” takedown SLA)?
8. **Platform scope:** Web only vs mobile app vs “feeds only” product? (This affects P6 UI investment.)

### Group 2 — High-impact assumptions (roadmap can proceed with assumptions if you prefer)

1. **Source supply model:** In MVP, will events come primarily from:

   * organizer submissions,
   * curated lists (specific calendars/orgs),
   * allowed APIs,
   * or allowed crawls? (This determines P1 connector scope.)
2. **Calendar strategy:** Is “subscribe via ICS/webcal” sufficient for MVP, or do you need **Google Calendar push** or **Outlook sync** in V1? ([DOC-6], [DOC-5])
3. **Quality bar / governance:** Do you want an editorial review queue for featured events, or fully automated ingestion + spam controls?
4. **Monetization timing:** Do you want to charge organizers in the first 3 months (Pro Host), or delay monetization until you have distribution proof? ([DOC-13])

### Group 3 — Nice-to-have refinements

1. **Vertical focus:** Startups/AI/community are used as example signals—what are your initial “signal types”? ([DOC-12])
2. **Brand positioning:** “Calendar Club” is referenced—keep this name/positioning or treat as placeholder?
3. **Data/infra preferences:** Any strong preference for Postgres + (Azure AI Search/OpenSearch) vs ClickHouse early? ([DOC-4], [DOC-15], [DOC-23])
4. **UI ambition:** Is the “human week view” a differentiator you want early, or do you prefer to embed into existing calendars via feeds? ([DOC-11], [DOC-5])

---

If you reply with your survey selections (e.g., **1B, 2B, 3B…**) and answer the **Group 1** questions, I will generate the phased roadmap exactly in the format you specified (strategy summary, MVP→V3 roadmap with metrics, dependencies, risks/mitigations, validation plan, milestone timeline, PRD skeleton, and decision log).
