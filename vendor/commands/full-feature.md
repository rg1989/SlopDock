---
name: full-feature
description: Implement a complete feature with frontend, backend, and tests
argument-hint: "[feature-description]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
---

<objective>
Implement a complete full-stack feature from description to deployment-ready code.
</objective>

<process>
1. Parse feature requirements from $ARGUMENTS
2. Design API contract (backend-developer agent)
3. Implement backend endpoints (backend-developer agent)
4. Create frontend components (frontend-developer agent)
5. Write integration tests (qa-tester agent)
6. Review for security (security-auditor agent)
</process>

<output>
- API endpoints in `src/api/`
- React components in `src/components/`
- Tests in `tests/`
- Documentation in `docs/`
</output>
