# Lessons Learned: Agent System Prompt Patterns

## WhatsApp AI Identification Failures
- **Mistake**: Introducing the agent by a system name ("NegoFlow") or a formal role ("asistent personal al cumpărătorului").
- **Fix**: Use human-centric representing phrases: "Îl ajut pe un cumpărător", "Reprezint un prieten interesat".
- **Reason**: People on marketplace sites (OLX/Facebook) are wary of agencies and bots. Simple, direct communication builds trust.

## Contextual Blindness (Location)
- **Mistake**: Suggesting general meeting spots (e.g. "Piata Unirii, Bucuresti") without verifying the property's city.
- **Fix**: Always extract the city from the source ad and use it. If unknown, ask "Unde ne putem vedea?".
- **Reason**: Physical transactions require geographic consistency. Proposing a different city immediately marks the user as a non-human entity.

## Placeholder Hallucination (Fatal Error)
- **Mistake**: Including placeholders like `[Numele tău]` or `[Adresă]` in the final message sent to the user.
- **Fix**: Always define a fallback name (e.g., "Dragoș") or use generic nouns ("un coleg", "interesat de anunț"). NEVER use square brackets `[]` in prompt instructions exposed to the raw message generation.
- **Reason**: Placeholders are the 100% confirmation for the user that they are speaking to a bot.

## Template Over-Formalism
- **Mistake**: Repeating the full property address ("Bd. Socola, nr. 12") or using "spam-like" praise ("apartamentul dvs. deosebit").
- **Fix**: Use colloquial markers ("cel din Socola", "apartamentul acela") and avoid adjectives that sound like marketing scripts.
- **Reason**: Real humans rely on shared context (the fact that they are already chatting about a specific ad) and don't need to be overly formal.

## Ghost "Running" Missions After Server Restart
- **Bug**: When the server restarts, missions with `status: 'running'` persist in MongoDB. The orchestrator is in-memory and loses all state. UI shows "RUNNING" but backend does nothing.
- **Fix**: In `MissionRepo.init()`, detect all missions with an active status (`running`, `scraping`, `revealing`, etc.) and reset them to `interrupted` before the server starts accepting requests. Persist the change to DB via `bulkWrite`.
- **Rule**: Any in-memory state that can be persisted must be reconciled with DB state on boot. Never trust a "running" status from a previous process lifecycle.
