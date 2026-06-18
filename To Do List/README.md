# To Do List — Folder README

> One file. Three sections. Everything lives here.

---

## The file: `To_Do_List.md`

**One file only.** No rule-update staging file. No second parking surface of any kind. Everything goes in `To_Do_List.md`, routed to the right section.

---

### Section 1: ✈️ My Tasks
**Owner:** the owner. **Claude's access:** read only — never edit, never append.
Private tasks — bookings, flights, hotels, logistics, anything personal.

### Section 2: 🔧 Edits to Files under Core Rules Folder
**Owner:** Claude proposes, approved. **Flow:** proposal written here → approved in same session → Claude applies change to matching HTML file in `Brain/CORE RULES/` → item deleted.
Cross-session tasks, rule proposals, open items, anything needing to carry forward.

### Section 3: ❓ Open Questions
**Owner:** Claude writes during builds. reviewed.
Mid-build questions that surface during a guide build and would otherwise block ship. Park here and keep building. Never blocks ship.

---

## Routing table

| Trigger | Goes to |
|---|---|
| Mid-build ambiguity, question for the owner | ❓ Open Questions |
| *"park this," "add to the to-do list," "log this," "what's pending?"* | 🔧 Edits to Files under Core Rules Folder |
| *"add this rule," "new rule:," "amend the {section}," "lock this in"* | 🔧 Edits to Files under Core Rules Folder — then wait for approval before touching HTML |
| Private trip tasks (bookings, flights, hotels) | ✈️ My Tasks — owner writes only |

---

## Hard rules

- **Never create a second file.** One parking surface, one file. No `HAND_OFF.md`, no `rules_updates.md`, no `session_notes.md`, nothing. If it doesn't fit a section of `To_Do_List.md`, it doesn't get its own file — surface it in chat.
- **Resolved items are deleted.** No strikethrough, no archiving of completed tasks. Just delete the line.
- **Rule-change flow:** proposal in 🔧 → approved in same session → HTML edit → delete item. No batching, no staging, no extra steps.

---

## Source of truth for guide rules

`Brain/CORE RULES/*.html` — canonical, owner-authored. The only source of truth for guide rules.
`To_Do_List.md` 🔧 Edits to Files under Core Rules Folder — proposals pending the owner's approval. Not yet authoritative until applied to the HTML.

---

*Rewritten 2026-05-08 — consolidated to one file with three sections.*
