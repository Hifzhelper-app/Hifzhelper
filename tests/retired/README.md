# Retired checks

`verify_seed_dev_tool.mjs` records safeguards for the completed one-off
production-to-development seed process. It is not part of routine application
validation and does not indicate that database backups are configured.

Retained for historical reference, not as a current passing gate. Its original
backup-ignore assertion no longer matches the repository. Reassess this diagnostic
and the entire one-off process before any future reuse; do not run the seed script
as part of testing. Git history also preserves the original root-level test.
