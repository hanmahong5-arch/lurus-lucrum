# Lurus Gushen

AI quantitative trading platform. Next.js 14 + TypeScript + Python (vnpy).

**Use `bun`, not `npm`.**

## Commands

```bash
# Web (gushen-web/)
bun run dev / bun run build / bun run typecheck
bun run test -- -t "test_name"
bun run lint

# K3s operations
ssh root@100.98.57.55 "kubectl -n ai-qtrd get pods"
ssh root@100.98.57.55 "kubectl -n ai-qtrd rollout restart deployment/gushen-web"
```

## BMAD

| Resource | Path |
|----------|------|
| PRD | `./_bmad-output/planning-artifacts/prd.md` |
| Epics | `./_bmad-output/planning-artifacts/epics.md` |
| Architecture | `./_bmad-output/planning-artifacts/architecture.md` |
| UX Design | `./_bmad-output/planning-artifacts/ux-design-specification.md` |
| Sprint Status | `./_bmad-output/implementation-artifacts/sprint-status.yaml` |
