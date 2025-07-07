# CCL-3 Repository Structure

This repository contains two versions of the CCL-3 system:

## 📁 Directory Structure

```
ccl-3/
├── legacy-ccl3/          # Original CCL-3 implementation (ARCHIVED)
│   └── [Original files will be moved here]
│
├── ccl3-swarm/          # NEW multi-agent implementation
│   └── [SWARM-based system goes here]
│
├── docs/                # Shared documentation
│   ├── HANDOFF_NOTES.md
│   ├── CCL3_SWARM_MIGRATION_PLAN.md
│   └── ARCHITECTURE_DECISIONS.md
│
└── README.md           # This file
```

## 🚀 Quick Start

### For NEW Development (Recommended)
```bash
cd ccl3-swarm
npm install
npm run dev
```

### For Legacy Reference Only
```bash
cd legacy-ccl3
# DO NOT USE FOR NEW DEVELOPMENT
# This is kept for reference and migration purposes only
```

## 🎯 Which Version Should I Use?

- **ccl3-swarm**: ALL new development happens here
- **legacy-ccl3**: Reference only, do not modify

## 🏗️ Architecture

### Legacy CCL-3 (❌ Deprecated)
- Monolithic architecture
- Single application handling everything
- Complex JWT auth
- Over-engineered for internal tool

### CCL-3 SWARM (✅ Active Development)
- Multi-agent architecture
- Specialized agents for different tasks:
  - 🧠 Overlord Agent: Orchestrates everything
  - 📧 Email Agent: Handles email communication
  - 📱 SMS Agent: Manages text messaging
  - 💬 Chat Agent: Website chat interface
- Clean separation of concerns
- Leverages existing SWARM PWA foundation

## 📊 Migration Status

- [x] Architecture decision made
- [x] Repository structure created
- [ ] SWARM PWA forked and adapted
- [ ] Legacy code moved to archive
- [ ] Agents configured for business logic
- [ ] External integrations connected
- [ ] Production deployment

## 👥 For New Developers

1. **Ignore legacy-ccl3** - It's only there for reference
2. **Start in ccl3-swarm** - This is the active codebase
3. **Read the migration plan** - `docs/CCL3_SWARM_MIGRATION_PLAN.md`
4. **Understand the agents** - Each agent has one specific role

## 📝 Key Documents

- [Migration Plan](docs/CCL3_SWARM_MIGRATION_PLAN.md) - Why and how we're migrating
- [Handoff Notes](docs/HANDOFF_NOTES.md) - Original system analysis
- [Architecture Decisions](docs/ARCHITECTURE_DECISIONS.md) - Coming soon

---

**Questions?** The new multi-agent system is simpler and more maintainable than the legacy version. When in doubt, check the ccl3-swarm implementation.