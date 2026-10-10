# Data Retention and Account Anonymization

PairPeers follows a privacy-by-design policy. This document details how personal data is retained, how account deletion operates, and what data persists to preserve community safety and mutual accountability.

## Retention Periods by Data Class

| Data Class | Retention Period | Description |
|---|---|---|
| Active Profile Identity | Duration of membership | Telegram ID, display name, username, membership status. |
| Questionnaire Responses | Active membership | Private dating preferences and lifestyle traits. Wiped immediately upon deletion. |
| Match Records | Indefinite | Mutual connection status and cycle metadata. Preserved as an anonymized record. |
| Match Feedback & Dates | Indefinite | Private outcome notes and date coordination status. Retained without personal identifiers. |
| Vouches | Indefinite | Friend references. Received vouches remain on recipient profiles; given vouches remain anonymized. |
| Invite Codes & Redemptions | Active / Indefinite audit | Unredeemed invites expire upon deletion. Redemption audit records (IP hash and timestamp) persist for sybil prevention. |
| Safety Reports | Indefinite | Incident reports and resolution notes persist to protect the community. |
| System Events | Indefinite append-only | Operational metrics with pseudonymized actor identifiers. |

## Deletion and Anonymization Model

When a member deletes their account:

1. **Tombstone, not hard delete**: Hard deletion of a database profile would cascade delete partner match histories, destroying the other person's mutual records. Instead, PairPeers applies cryptographic anonymization with a `deleted_at` tombstone.
2. **Scrambled Telegram ID**: The member's real Telegram ID is replaced with an unlinkable negative identifier, preventing future linkage while satisfying database integrity.
3. **Data scrub**: Username is cleared, display name is changed to 'Former Member', membership is revoked, and questionnaire responses are wiped clean.
4. **Invite revocation**: Any unredeemed invite codes created by the profile expire immediately.

## What Survives Deletion

- **Partner match history**: Your past matches continue to see that an introduction took place, but your name appears as 'Former Member' with contact details removed.
- **Safety reports**: Reports filed against or by an account remain in founder queues to protect against misconduct.
- **Aggregated metrics**: System events and cycle performance data remain recorded without personal identity.

## Tombstone Policy and Ban Evasion

- **Account recreation**: If an anonymized user signs in again via Telegram, they are treated as an unverified new user. They possess no prior vouchers and must acquire a new invite code to re-enter.
- **Banned accounts**: Banned members cannot clear their ban status through account deletion. Safety bans persist permanently on the Telegram identity record.
