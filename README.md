# RemoteOps — hiring hackathon

Two-day take-home. One application: a multi-org permission console.

The candidate-facing material describes behaviour, not mechanism: what the permission model does,
what the interface returns, and which elements the console has. How to build it, how to structure
it, and how it looks are the candidate's decisions. The database schema is the ground truth;
where a document and the schema disagree, the schema wins.

This file is for organisers. It records what ships, what must be removed before it does, and
which packaging problems are still open. It is the only file here written for us rather than for
the candidate.

---

## The application

`q1-starter/` is the application: one process, one port, one command.

```sh
cd q1-starter
npm install
npm run db:reset     # schema + reference data + demo fixture
npm run dev          # http://localhost:8080
```

Its own README carries the given-versus-yours file split, the demo fixture, the test commands,
the speed expectation, and the `PRAGMA foreign_keys` trap.

---

## What the candidate builds

Everything under `server/routes/`, all of `web/`, the four server modules the routes stand on
(`context.js`, `permissions.js`, `lifecycle.js`, `audit.js`), and `verifyAccessToken` in
`server/auth.js`, which ships as a stub.

## Time box

Two days. Commit as you go — the history is read, and it is the primary evidence the work is
theirs. Ends with a walkthrough in which the candidate explains their decisions and modifies
their own code live.

## How it is graded

| Weight | Artifact | What it measures |
|---|---|---|
| 50% | the code, against a hidden tier | that it works |
| 30% | `BUILD-LOG.md` + `DECISIONS.md` | **that they understand it** |
| 20% | the live walkthrough | that the two agree |

The middle third is the part that makes the other two trustworthy. The candidate-facing half is
`DISCOVERY-BRIEF.md`, which ships inside `starter/` along with templates for both documents. It
asks for *method* — a wrong prediction, a reversed decision, an observation that changed their
model, a rejected alternative and why it fails — and never enumerates the concepts themselves,
because discovering them is the exercise.

Two mechanisms do the work, and neither depends on trusting prose:

1. **The log must grow alongside the code, in its own commits.** `git log --follow --
   BUILD-LOG.md` next to the code commits says whether the candidate produced a record or a
   story. A log delivered in one commit at the end is capped at *Adequate* however well it reads.
2. **The live round is drawn from the candidate's own log.** We sample their entries at random and
   ask them to go deeper, take a rejected alternative, and open the line that makes a decision.
   A log they cannot defend is a log they did not write.

The 20% verifies the 30% rather than standing alone: an indefensible candidate scores *Weak* on
the write-up, and if they cannot account for submitted code, the artifact score is capped too —
not as punishment, but because the work cannot be attributed.

`DISCOVERY-RUBRIC.md` (organiser-only) carries the concept list, the scoring bands, the
fabrication checks to run before reading a word, and the live-round script.

---

## What ships

| Path | Ships? |
|---|---|
| `BRIEF.md`, `PERMISSIONS.md`, `AUTH-DATA-MODEL.md`, `UI-INVENTORY.md` | ✅ candidate-facing |
| `WORKFLOW.md` | ✅ candidate-facing — currently untracked, add it before packaging |
| `starter/DISCOVERY-BRIEF.md` | ✅ candidate-facing — installs into the hand-out with the templates |
| `DISCOVERY-RUBRIC.md` | ❌ organiser-only: the reflection answer key and the live-round script |
| `q1-starter/` | ✅ the candidate repo — regenerate `starter/` with `tools/strip-starter.mjs` |
| `starter/` | ✅ the generated hand-out — never hand-edited |
| `tools/` | ❌ organiser-only: the strip, the fixture generator, the overlay proof |
| `candidates/` | ❌ organiser-only: per-candidate hand-outs and manifests (gitignored) |
| `HACKATHON-PLAN.md` | ❌ organiser-only: scoring internals, anti-cheat, calibration |
| the rest of `evaluate/` | ❌ evaluator-only: the hidden tier, the rubric, and the answer keys |

---

## Strip the starter before handing it out

**`q1-starter/` is the reference implementation, not a starter.** The rest of the answer is in
the tree, so it must not go out as-is. This is now automated and reproducible:

```sh
node tools/strip-starter.mjs          # q1-starter/ -> starter/  (the hand-out)
node tools/new-candidate.mjs <id>     # starter/ -> candidates/<id>/ with a unique fixture
```

The strip removes every file the candidate writes (`web/` except a placeholder entry,
`server/{permissions,context,lifecycle,audit}.js`, `server/routes/*.js`, and the candidate's own
`NOTES.md`), replaces them with throwing stubs so the process still boots and the shipped suites
still run, re-stubs `verifyAccessToken`, and installs the personalisation overlay. See
`HARDENING.md`.

Do not hand-edit `starter/` — it is generated. Change `tools/templates/` or the reference tree
and re-run the strip.

### The personalisation overlay

Every hand-out gets one extra organization that appears in no document: an undocumented role, an
undocumented permission, a per-candidate baseline, and a device-scoped `allow` and `deny` of that
permission on two different devices. It is **strictly additive** — it never touches the two
documented organizations — because the shipped suites assert exact counts
(`check-api.js:54`, `:92`; `ui.spec.js:129`, `:192`, `:234`) and a non-additive overlay would make
every candidate look broken.

Grading must run with a **different nonce** than the one shipped, so the values a candidate can
read in `scripts/personalise.js` cannot be baked in:

```sh
CANDIDATE_NONCE="grade/$ID/$(date +%s)" ...
```

`node tools/verify-overlay.mjs` proves the overlay is non-perturbing: it loads the overlay into the
reference tree and asserts all four shipped suites still pass (35 + 43 + 66 + 25). Re-run it
after any change to the overlay, the fixtures, or the suites.

---

## Still open (hardening)

Three changes from the same review are **not** implemented here and are the ones that defeat a
blind prompt rather than a careless candidate:

1. Replace the prose algorithm (`WORKFLOW.md:34`, `PERMISSIONS.md §4`) with a sealed
   pass/fail oracle, so the resolution order has to be inferred rather than read.
2. Build the hidden tier around the seams the specs leave open — offboard/rehire, self-transfer,
   suspension on ungated routes, malformed-token fuzzing, cross-scope laundering, concurrent
   inserts against the partial unique index.

Both are compatible with candidates discovering the concepts themselves; the oracle withholds an
answer, it does not withhold an observation. Deliberately NOT proposed: making the documents
vaguer, which breaks the fixed contracts the tests read, and declaring a no-AI rule, which is
unenforceable and punishes honest candidates. The graded write-up plus the live round is the
enforcement mechanism instead — see `DISCOVERY-RUBRIC.md`.

---

## Open packaging items

1. **Documentation citations are stale.** The candidate-facing specs are trimmed versions of the
   pre-trim originals kept in `evaluate/reference/`. Several code comments, and the first line of
   `scripts/check-permissions.js`, still cite section numbers that only exist in the full
   versions. Either align the numbering or update the citations before the repo is handed over.

2. **Assertion counts disagree across the organiser notes.** The public UI suite now has 25
   tests, including three added for sign-in failure feedback; the older notes still say 19 or
   22. State the sizes once, in one place, or not at all.

3. **Sign-in failure feedback is now graded.** `login-error` is part of the console inventory,
   asserted by three public UI cases, and covered by hidden tier I (10 backend assertions) plus a
   seven-case `failure feedback — sign-in` block in the hidden UI matrix. The evaluation plan and
   runbook now carry the new counts (51 backend, 121 UI); `FEEDBACK_CASES` in `eval.sh` must
   track the UI block if it changes.

4. **Suite sizes are runtime counts, not line counts.** One public suite contains a six-way loop
   behind a single call, so grepping for assertions returns a smaller number than a run reports.
   Anyone re-counting that way will get a different figure and may "fix" it.
