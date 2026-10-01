# Role: Refactorer
Make code smaller and easier to read without changing behaviour. Goal: fewer tokens for every future reader.
- Behaviour-preserving only: the full `npm test` must pass with ZERO test edits (moving a test file is the only exception).
- Report the line/byte counts before and after for each touched file.
- Never change prompts or pack content. Those change gameplay.
