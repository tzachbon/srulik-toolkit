# UI proof requirements: verification evidence

Plugin version: 1.16.1. Baseline: 66f8c04f2042e81bbcd4aca30c835149d731fceb.

## Checks

`./scripts/validate.sh` and `git diff --check` passed on Linux. Both old skill
snapshots fail the extended instruction contracts. Each of 15 new required
phrases was removed independently in a scratch copy: its real validator failed
with the expected missing-contract message, then passed after restoration.
Reintroducing the retired unconditional text-only fallback was rejected. A
mismatched package version was also rejected.

## Independent instruction fixtures

Old and revised skills were read in separate fresh Codex child sessions using
GPT-6.1 Sol with inherited xhigh effort and identical fixture restrictions.
The tasks produced actual Markdown outputs. There was one run per configuration.

1. **UI with hosted proof:** fix an overlapping mobile Settings Save button;
   all readiness, validation and media-safety gates pass. A supplied durable
   screenshot URL is accessible to reviewers. Prepare the description and next
   action. Both versions include the URL and permit creation after the final
   existing-PR query. The revised output embeds the screenshot in Evidence.
2. **UI without proof:** the same fix and passing checks, but no screenshot,
   recording, capture access, upload support or hosted artifact. Prepare the next
   action and a body only if creation is allowed. The old output permits creation
   with textual evidence. The revised output says: “Stop before PR creation,
   including a draft.” It prepares no body and identifies the missing access.
3. **Backend only:** server JSON timestamp parser, passing focused/required
   checks, no rendered effect or media. Both outputs permit creation without
   media; the revised output explicitly labels media optional.
4. **UI verification contract:** Save button overlap at 390 CSS pixels; application
   execution is prohibited in the fixture. Both outputs plan screenshots and an
   overlap check, labeling red/green results unrun. The revised output records
   capture steps, matching screen/state and before/after viewport dimensions.

## Review and limits

One independent review round covered the full diff and relevant callers using
Claude Opus 5.5, Gemini 4 Argon and Kimi K3.1 Pro at high effort. No blocking
findings remained. Optional wording and guard-hardening suggestions were declined
because the publication reference already governs attachment rewriting and
upload authority; the remaining suggestions do not change required behavior.

Phrase checks prove instruction contents. Fixtures prove interpretation for
these synthetic tasks only. No real PR attachment upload, application runtime,
installed-plugin activation or cross-platform runtime was exercised. No token
or time measurements are claimed. Human fixture-review feedback is pending.
