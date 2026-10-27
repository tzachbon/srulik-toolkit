# Comments posted for the user

Apply these rules to every comment an agent posts for the user on a pull request or issue: top-level comments, inline review comments, replies to bots or reviewers, review bodies, and the written reason before resolving or dismissing feedback. Skip them for PR descriptions, commit messages, and text the user asked to post verbatim.

Start the comment with this callout:

```md
> [!NOTE]
> 🤖 **<model> responding on behalf of <user>**

The reply starts here.
```

- Use the public model name the harness reports. If it reports none, use the harness name. Do not guess.
- Use the user's name or provider login.
- Keep the attribution inside the callout and the reply outside it. Add no heading, rule, signature, or second attribution.

Write the reply directly: lead with the conclusion, cite the code, check, or reproduction, and separate verified facts from judgment. No canned thanks or status narration.

Before posting, check the whole comment, including quotes and attachments, for secrets and private details, and preview the Markdown. After posting, confirm the provider returned the comment or review URL. Resolve a thread only after its reply posted.
