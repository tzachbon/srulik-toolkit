---
name: tour
description: Research any topic's history, context, decisions, and current flow, then explain it as a sourced narrative with a focused visual. Use when the user asks for a tour, historical walkthrough, evolution story, or an easier way to understand how something came to be and works now.
---

# Tour

Turn a topic into an evidence-backed story: why it exists, how it evolved, and how it works now. Lead with the current state at a glance, then reveal the history and supporting detail. Do not trade accuracy for a smoother narrative.

## Research the story

Frame the user's topic and relevant conversation context as a bounded research brief: the audience, central question, useful time range, available repository or external evidence, and the facts needed to explain origin, evolution, decisions, and current flow.

Invoke `$research` for every tour. Request **very thorough** depth and **chat-only output** so it returns a cited evidence base without creating a competing repository artifact.

- For repository topics, inspect the current implementation and trace relevant files, tests, documentation, commits, issues, and pull requests when available.
- For external topics, prefer current primary sources and the sources that own each material claim.
- Treat conversation statements as user decisions or context, not independent proof.

After research, separate verified facts, user decisions, inferences, and unresolved gaps. Cite material claims where they appear. Commit history proves what changed; state motivation as fact only when an authoritative source supports it.

If an unresolved gap would materially change the tour's scope, chronology, or interpretation, grill the user after the initial research: ask 1–3 independently answerable questions and recommend an interpretation when evidence supports one. Then invoke `$research` again for targeted follow-up. Do not interrupt for harmless omissions.

## Show the central idea

Once the chronology and current flow are understood, invoke `$show-me` for every completed tour. Ask it for the smallest visual that clarifies the central chronology, flow, or relationship. Prefer an inline timeline, call tree, file tree, state flow, Mermaid diagram, or diff; use focused HTML only when the idea is too dense for those forms.

For HTML, require a collision-safe, OS-managed temporary path outside the repository and open the artifact from that path. Context-encode every untrusted topic, repository, and research value before inserting it; keep scripts static and trusted, and load no remote resources.

If HTML cannot be opened, ask `$show-me` for an inline Mermaid or text fallback. If `$research` or `$show-me` is unavailable, stop and name the missing required skill instead of silently imitating it.

## Write the tour

Use this shape, omitting only an empty uncertainty section:

```markdown
# Tour: <topic>

## At a glance
<current status, central purpose, and shortest useful orientation>

## Why it exists
<originating problem and context>

## The story
<chronological chapters connecting evidence, decisions, and consequences>

## How it works now
<current actors or components, flow, and important boundaries>

## Visual guide
<inline visual or link to the show-me artifact>

## Important turns and tradeoffs
<decisions that changed the direction and alternatives that mattered>

## What remains uncertain
<conflicts, gaps, and labeled inferences>

## References
<repository pointers and external links>
```

Write the complete tour to a collision-safe, OS-managed temporary Markdown file outside the repository. Use a safe topic slug in the filename when the runtime supports it. If writing fails, return the complete tour in chat and report the artifact failure.

In chat, give the at-a-glance summary, include the visual or its artifact link, and link the complete temporary Markdown file with its absolute path. If evidence is insufficient, deliver a clearly bounded partial tour and preserve the gaps; never invent connective history.
