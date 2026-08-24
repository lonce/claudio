# Pushing to GitHub

When the user asks for a **push** ("push", "let's push", "push this"), run
this routine. It's a project-specific extension of the standard git-commit
behavior already followed by default (new commits rather than amends, no
force-push, no skipped hooks, review before staging broadly) — read this as
additions on top of that, not a replacement for it.

## The routine

1. **Check status first.** `git status`, and `git diff` on anything
   ambiguous. Stage files individually or by directory (`git add <paths>`),
   not a blanket `git add -A`/`-A .`. Use judgment about what belongs in
   the repo versus what doesn't, and ask if unsure rather than guessing:
   - Reference material pulled in for research (e.g. a downloaded dataset
     or someone else's repo, unzipped into a working directory) is
     probably not meant to be committed as project source — flag it and
     ask, don't silently include or silently drop it.
   - Anything that looks like it could hold a secret or credential gets a
     closer look before staging, regardless of filename.
   - Genuinely new/changed project source (`soundlib/`, `app/`, `docs/`,
     `CLAUDE.md`, etc.) is normally exactly what should go in.

2. **Work out what's changed since the last push**, not just since the
   last commit — there may already be local commits sitting unpushed. Fetch
   and compare against the upstream branch:
   ```
   git fetch origin
   git log origin/main..HEAD --oneline   # commits not yet on GitHub
   git diff --cached --stat              # what's about to become a new commit
   ```
   Both contribute to the summary in the next step.

3. **Write one concise paragraph** summarizing the work being pushed —
   covering both anything from step 2's unpushed commits and the new commit
   about to be created. Prose, not a bulleted changelog; focus on *why*
   more than a mechanical list of files. This becomes the commit message
   body (see the standard commit-message format/`Co-Authored-By` trailer
   already in use).

4. **Show the user that paragraph before committing anything.** Wait for
   their go-ahead (or an edit) rather than committing straight away — same
   spirit as step 6's tag-name check, just one step earlier.

5. **Commit.** One new commit for the currently staged changes (don't fold
   it into or amend any prior unpushed commit).

6. **Ask for a tag name before tagging anything.** Offer one suggested
   name — short, lowercase, hyphenated, reflecting the main theme of the
   work (e.g. `chua-presets`, not a formal semver number; this project
   isn't semantically versioned) — and wait for the user's answer or
   override. Then:
   ```
   git tag -a <name> -m "<the same one-paragraph summary>"
   ```

7. **Push the branch and the tag:**
   ```
   git push origin main
   git push origin <tag>
   ```
   Confirm first that the current branch and `origin` remote are what's
   expected (`git branch --show-current`, `git remote -v`) — this project's
   remote is `git@github.com:lonce/claudio.git`. If either looks
   unexpected, stop and check with the user instead of pushing.

8. **Report back**: what got committed (and what, if anything, was
   deliberately left out and why), the tag name and message, and
   confirmation that both the commit and the tag landed on GitHub.

## What this routine does not do

No force-push, no rewriting existing history, no skipping hooks. If a
pre-commit/pre-push hook fails, fix the underlying issue and try again
rather than bypassing it. If there's nothing new to push, say so instead of
creating an empty commit or an empty tag.
