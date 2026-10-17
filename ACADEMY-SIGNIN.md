# Academy PIN and sign-in — V5.0

Development frontend: `https://hifz.maktab4life.org/`.
Development API: `https://hifzhelper-api-dev.hifzhelper-app.workers.dev`.
Repository copy: `https://github.com/MaktabForlife/Hifz` (main/dev history preserved).
The separate Hifz Cloudflare account and development D1 remain in use.

## PIN authority

Academy is authoritative for linked PINs. New/reset PINs are entered and confirmed
in Academy. Both Workers use `v3$pbkdf2-sha256$100000$<base64url salt>$<hex key>`,
a fresh 16-byte salt and 32-byte derived key. The PBKDF2 password material is the
four-digit PIN, NUL separator and the shared `SHARED_PIN_SECRET` Worker binding.
The separate pepper is never stored in D1, source control, frontend responses or
logs. The native Workers iteration ceiling is 100,000. Legacy credentials retain
their original verification keys until a successful sign-in transparently upgrades
them. No bulk PIN reset is performed.

Academy setup, reset and hash upgrades enter its durable profile queue. The exact
shared record is sent only in authenticated private Worker-to-Worker messages.
`source_credential_epoch` and source revisions prevent older packets restoring old
PINs. A changed credential or distinct reset increments Hifz's local epoch, clears
lockout and revokes existing sessions/passes. Hifz setup/reset is blocked for linked
users. Unlinked legacy accounts can still use confirmed local setup and upgrade to
the stronger format. Direct personal links retain PIN authentication.

## Academy entry

1. Academy's personal Hifz link adds `?academy=1`.
2. Hifz creates random 32-byte verifier/state values in that tab's sessionStorage,
   and sends only state, SHA256 challenge and the expected login alias to the fixed
   Academy `/academy/hifz/` page.
3. That page uses its own stored Academy session. The API verifies the current
   server-side session, epoch, active account and effective Hifz membership.
4. The Academy Worker sends a current profile assertion to Hifz's internal handoff
   endpoint, authenticated by HMAC with the distinct `hifz-handoff-v1:` purpose.
   Hifz applies the current profile before minting a random one-use code. The DB
   stores only its digest, challenge, student UUID, local epoch and 60-second expiry.
5. The code returns in the fixed Hifz URL fragment. Hifz removes it from history
   immediately and accepts it only with the original state/verifier and configured
   frontend Origin. Atomic DELETE RETURNING ensures one redemption. Current local
   activity and epoch are checked before issuing a normal Hifz session.

No caller chooses a return address or role. No PIN/hash or Academy session token
travels between frontend origins. Temporary codes never enter query strings or
referrers; authentication responses use private no-store headers. Journal use has
no Academy dependency after entry. No production settings or database are changed.

## Rollout and checks

Hifz migration 0033 adds the source epoch and indexed temporary code-digest table.
Academy migration 0029 queues PIN setup/upgrades; the existing reset trigger remains.
Configure the matching development-only pepper and deploy the receiver before the
sender. Keep the previous PIN secrets for transparent legacy verification.

Security checks cover native PBKDF2 interoperability, exact copied hashes, correct
and incorrect PINs, signatures, wrong targets, assertion/code expiry, wrong browser
origin, wrong verifier/state, code replay, revoked membership, reset/session/pass
revocation, alias changes without journal rekeying and direct PIN entry. The browser
must finally open the existing user's journal from Academy without another PIN.
