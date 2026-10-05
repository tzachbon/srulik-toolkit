# GLOSSARY.md Format

## Structure

```md
# {Domain Name}: Glossary

{One or two sentence description of what this context is and why it exists.}

## Language

**Order**:
{A concise description of the term}
_Avoid_: Purchase, transaction

**Invoice**:
A request for payment sent to a customer after delivery.
_Avoid_: Bill, payment request

**Customer**:
A person or organization that places orders.
_Avoid_: Client, buyer, account

## Relationships

- An **Order** produces one or more **Invoices**
- An **Invoice** belongs to exactly one **Customer**

## Example dialogue

> **Dev:** "When a **Customer** places an **Order**, do we create the **Invoice** immediately?"
> **Domain expert:** "No. An **Invoice** is only generated once a **Fulfillment** is confirmed."

## Flagged ambiguities

- "account" was used to mean both **Customer** and **User**. Resolved: these are distinct concepts.
```

## Rules

- **Be opinionated.** When multiple words exist for the same concept, pick the best one and list the others as aliases to avoid.
- **Flag conflicts explicitly.** If a term is used ambiguously, call it out in "Flagged ambiguities" with a clear resolution.
- **Keep definitions tight.** One sentence max. Define what it IS, not what it does.
- **Show relationships.** Use bold term names and express cardinality where obvious.
- **Only include terms specific to this project's context.** General programming concepts (timeouts, error types, utility patterns) don't belong even if the project uses them extensively. Before adding a term, ask: is this a concept unique to this context, or a general programming concept? Only the former belongs.
- **Group terms under subheadings** when natural clusters emerge. If all terms belong to a single cohesive area, a flat list is fine.
- **Write an example dialogue.** A conversation between a dev and a domain expert that demonstrates how the terms interact naturally and clarifies boundaries between related concepts.

## Select the vocabulary file

Follow the repository's instructions and existing domain map first. New projects
use a root `GLOSSARY.md`, created lazily when the first domain term is resolved.
For multiple domains, use the relevant domain's glossary and index it in the
existing steering or map file; create no extra map merely for the filename change.

Existing `CONTEXT.md` and `CONTEXT-MAP.md` files remain supported. Read a context
map to find the relevant domain, then use that domain's `GLOSSARY.md` if present,
or its existing `CONTEXT.md` otherwise. When both exist, use `GLOSSARY.md` for
vocabulary and retain `CONTEXT.md` for background. Update only the selected
vocabulary file; do not create a duplicate glossary, rename existing project
files automatically, or discard relationships and other context. Resolve
conflicting definitions against project guidance before changing a term.
