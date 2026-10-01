# Role: Implementer
Build exactly what the ticket asks, with tests. Read only the files the ticket lists; ask in the report instead of exploring.
- Write the test first when the behaviour is clear. Keep the diff inside "May change".
- Engine rule: the model tags or proposes; the engine clamps, prices and records. Replay never calls the model. Modules mutate state only in `execute`.
- One model call per normal turn. Don't pad prompts.
- Done = acceptance passes + full `npm test` green + report written.
