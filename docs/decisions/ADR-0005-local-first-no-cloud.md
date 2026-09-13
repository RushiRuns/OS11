# ADR-0005: Local-First, Zero-Cloud Architectural Foundation

## Status
Accepted

## Context
Most modern productivity tools rely on centralized cloud servers, remote databases, external authentication providers, and third-party SaaS APIs. This creates several major failure modes:
1. **Network Latency:** Every user action awaits network round-trips (100ms-500ms+), violating the "Insane Speed" North Star.
2. **Offline Vulnerability:** The software degrades or breaks entirely when working offline, on planes, or on spotty Wi-Fi connections.
3. **Privacy & Data Ownership Risks:** User notes, personal tasks, and confidential files reside on external servers subject to breaches, vendor lock-in, and unauthorized data harvesting.
4. **Service Outages:** Third-party cloud downtime incapacitates the user's daily workflow.

## Decision
OS11 establishes a hard architectural boundary: **Phase 1 is 100% Local-First. Zero Cloud. Zero External Auth. Zero AI/LLM APIs.**
- All data resides in a local SQLite file (`app.getPath('userData')/os11.db`).
- All attachments reside in the local application data directory on the user's physical drive.
- No network requests are made during normal operation (except for checking auto-updates via GitHub Releases).
- No external authentication SDKs (Auth0, Firebase, Supabase, OAuth). A local identity row (`local_identity`) with a UUID v4 and user-chosen display name is generated once on first boot.

### Future Unlock Path (Phase 2)
The local-first constraint does not preclude collaboration or multi-device support; rather, it dictates how they are built:
1. **Local Companion Sync (Phase 2):** An Android companion app will sync directly with the desktop over the local network using mDNS service discovery and encrypted WebSockets. Zero intermediate cloud relay.
2. **Peer-to-Peer Collaboration (Phase 2):** Real-time collaboration between users on the same local network or through user-hosted private relays.
3. **Schema Readiness:** Tables for Phase 2 (`users`, `devices`, `collaboration_members`, `sync_queue`) are pre-defined in `SCHEMA.md` to prevent future schema migration cascades.

## Consequences
- **Positive:**
  - True instant operations: every write, query, and search completes locally in single-digit milliseconds.
  - 100% offline capability by definition.
  - Absolute user privacy and data sovereignty. Zero telemetry or tracking.
  - No cloud infrastructure or recurring server hosting costs.
- **Negative / Considerations:**
  - Data backup is the user's responsibility until Phase 2 local backup/export utilities are built.
  - Cross-device sync requires both devices to be on the same local network (by design in Phase 2).
