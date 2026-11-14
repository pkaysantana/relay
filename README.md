# Doorstep

Prototype for coordinating transfers of care between services, built for the National MedTech Hackathon 2026 (Respond track, challenge 6, "Lost Between Services").

Every handed-over action becomes a tracked task with a named owner, a confirmed deadline, an explicit status and evidence of completion. That way a transfer that was "sent" or "acknowledged" is never mistaken for one that is "done".

All data is synthetic, and the prototype is not for clinical use.

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # engine invariants + pack tests
npm run build
```

Views:
- `/hub`: sending team. Review and confirm the information, generate the handover, confirm deadlines and send, then follow up on rejected or overdue actions.
- `/receive`: receiving team. Acknowledge the transfer, then accept responsibility (naming a professional), reject it, or ask for clarification. Then progress the tasks and record evidence.
- `/dashboard`: operational measures and event history.

Use the header controls to advance the demo clock and to reset the demo. For architecture, constraints and the pack how-to, see [CLAUDE.md](CLAUDE.md).
