<!--
  GitHub Profile README — paste into github.com/lorenzespinosa/lorenzespinosa repo, file: README.md
  (Create a repo named exactly after your username to make this your profile README.)
-->

# Hi, I'm Lorenz 👋 — Automation Architect

### I build **cost-resilient, deterministic automation infrastructure** that defeats the AI "token tax."

An autonomous AI agent can burn **5–30× the tokens** of a single chatbot call (Gartner), and today's LLM API prices are still subsidized below true compute cost — Sequoia called the gap the industry's **$600B question**, and the repricing has already begun (GitHub priced some premium models at **3.6–6× base**). When the subsidy ends, the bill lands on the business — not the vendor. My job is to make sure it never does.

I keep the heavy lifting **local, predictable, and self-hosted**, and put AI on a leash — used surgically, only where it earns its cost.

```text
Default stack decision:  "Can a rule decide this?"  ──► YES ──► deterministic logic   (cost: $0, hallucinations: 0)
                                                     └─► NO  ──► capped model call      (cached + cheapest-capable-model routed)
```

---

## 🛡️ How I beat the token tax

| Technique | What it does | Why it matters |
|---|---|---|
| **Deterministic-first design** | Rules & code handle anything predictable — validation, routing, sync, reconciliation | Zero tokens, zero hallucinations on the core; the bill stops scaling per-transaction |
| **Hybrid model routing** | Route each call to the cheapest *capable* model; reserve frontier models for the few hard steps | Cuts spend on the AI you actually keep |
| **Semantic caching** | Vector-match incoming requests against prior answers (Qdrant) | Kills repeat calls on high-repetition workloads |
| **Localized automation loops** | Self-hosted orchestration on your own infra — no third-party API in the critical path | No rate limits, no repricing surprises, no outages taking ops down |
| **Human-in-the-loop gates** | A person approves anything that touches money or client records | AI assists; it never decides unsupervised |

---

## 🧱 Stack

**Self-hosted orchestration:** `n8n` · `Docker Compose` · `Traefik` · `Temporal`
**Self-hosted data:** `Supabase` · `Postgres` · `Qdrant` (vector / semantic cache) · `Airtable`
**AI — minimized & on a leash:** local models · `Claude` (capped) · hybrid routing · `MCP`
**Languages & glue:** `Python` · `JavaScript` · REST / webhooks

---

## 🚀 Selected open source

The building blocks I ship with — the `validate → retry → fallback → audit` discipline that keeps the core deterministic and AI on a leash.

- **[openclaw-n8n-stack](https://github.com/lorenzespinosa/openclaw-n8n-stack)** — one-command Docker stack: OpenClaw AI agent + n8n + PostgreSQL, MCP pre-wired for multi-agent ops with a deterministic core.
- **[n8n-error-handling-pattern](https://github.com/lorenzespinosa/n8n-error-handling-pattern)** — the reliability backbone: retry with exponential backoff, dead-letter queue, fallback paths, audit logging.
- **[n8n-ai-agent-delegator](https://github.com/lorenzespinosa/n8n-ai-agent-delegator)** — orchestrator that routes plain-language commands to specialist agents with confidence scoring and human-in-the-loop gates.
- **[airtable-automation-toolkit](https://github.com/lorenzespinosa/airtable-automation-toolkit)** — staging layer, dead-letter queue, PII-masked audit logging, bidirectional sync.
- **[n8n-legal-ops-templates](https://github.com/lorenzespinosa/n8n-legal-ops-templates)** — production-grade ops templates: intake, missed-call recovery, billing sync, case routing. Zero real client data.
- **[n8n-lint](https://github.com/lorenzespinosa/n8n-lint)** — CLI linter for n8n workflow JSON: catches credential leaks, deprecated nodes, orphaned connections. 16 rules, zero config, CI-ready.

---

## 📊 By the numbers

- **50+** operational processes automated
- **$800K+** in hard-dollar savings
- **−70%** manual data entry on a 3-system intake pipeline · **+30%** lead conversion on a budget
- **Zero** missed invoices · **Zero** tokens on deterministic money paths · **Zero** hallucinations in critical paths

---

## 📫 Work with me

Building automation that's cheap to run, private, and predictable — and need someone to keep AI off the critical path?

📩 **renzespinosa13@gmail.com** · 🔗 **[lorenzespinosa.github.io](https://lorenzespinosa.github.io)** · 💼 **[LinkedIn](https://www.linkedin.com/in/lorenz-leslie-espinosa/)**

> *I build automation that runs on logic — not your AI budget.*
