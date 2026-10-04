# ADR-0010: GTD Buckets are Explicit and Mutually Exclusive with Dates

## Status
Accepted

## Context
OS11 incorporates Getting Things Done (GTD) concepts through optional modules: **Anytime** (undated, committed actions), **Someday** (parked maybes with no nag or reminders), and **Waiting For** (delegated or blocked tasks awaiting external action).

In designing task scheduling and state transitions, we needed to establish clear architectural rules regarding how undated tasks, due dates, buckets, and waiting states coexist.

### Evaluated Alternatives
1. **Implicit/Automatic Bucketing of Undated Tasks:**
   - *Proposal:* Any task without a due date automatically belongs to "Anytime" (or "Someday" by default).
   - *Problem:* A project often contains dozens of loose, unscheduled sub-steps or reference items. Dumping all undated tasks into Anytime turns Anytime into an untrusted, overwhelming backlog. The core value of Anytime is answering: *"What could I pick up right now if I had a free hour?"* It must remain a short, trusted list curated deliberately by the user.
   - *Rejected:* Violates the explicit curation principle.

2. **Allowing Due Dates and Buckets to Coexist:**
   - *Proposal:* A task can have both a due date (e.g., "Friday") and be marked "Anytime" or "Someday".
   - *Problem:* A task with a due date is scheduled for a specific deadline; it is no longer an "anytime" flexible action, nor is it a "someday" parked idea. Allowing both muddies the definition of Planned and Anytime, creates conflicting calendar badges, and confuses notification scheduling.
   - *Rejected:* Contradicts product semantics.

3. **Merging Follow-Ups into Planned:**
   - *Proposal:* Give follow-up dates the same status as task due dates and display waiting follow-ups in the Planned view.
   - *Problem:* Planned represents commitments with hard deadlines that the user must execute. A waiting follow-up is an external dependency (checking in with someone else). Muddying Planned with waiting check-ins dilutes the focus of Planned.
   - *Rejected:* Follow-ups surface cleanly in their own Waiting For view, in the My Day suggestions panel, and via dedicated OS notifications.

## Decision
We enforce three primary invariants across the domain model, queries, UI, and test suites:

1. **R1. Explicit Only:** No task ever receives `bucket = 'anytime'` or `bucket = 'someday'` as a side effect of being undated. Buckets are assigned exclusively via explicit user actions, quick-add tokens (`~anytime`, `~someday`), or adding a Someday task to My Day (which promotes it to Anytime under R10).
2. **R2. Date and Bucket Never Coexist:** Setting a due date clears any bucket. Setting a bucket clears any due date and associated reminders. All scheduling writes must pass through `TaskSchedulingService`. In any query where an invariant violation might occur (e.g. data import), the due date wins (task surfaces in Planned, not Anytime/Someday).
3. **R3. Waiting is an Overlay, Not a Bucket:** A waiting task can coexist with a due date or with Anytime. Marking Someday on a waiting task clears the waiting fields (as Someday represents uncommitted ideas). Marking Waiting on a Someday task clears the Someday bucket. Marking Waiting on an Anytime task preserves the Anytime flag, but the task temporarily drops out of the Anytime view until resolved.

## Consequences
- **Positive:**
  - Crystal-clear cognitive model: a single **When** field in the UI represents either a date, Anytime, Someday, or unset.
  - Predictable queries: smart lists compose deterministic SQL predicates without complex fallback hierarchies.
  - Trusted lists: Anytime remains a curated, high-confidence action list; Someday remains quiet without nagging reminders.
  - Single-writer safety: `TaskSchedulingService` mediates all state transitions with single undo entries and transactional integrity.
- **Negative / Considerations:**
  - Moving a dated task to Someday wipes its reminders; this destructive side effect must push an undo action and report the change in a toast notification.
  - Subtasks follow their parent container: subtasks cannot receive Anytime or Someday buckets (R11), though they can be marked Waiting.
