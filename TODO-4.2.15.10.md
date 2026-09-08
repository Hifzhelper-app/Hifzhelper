# Hifz Helper V4.2.15.10 — Sabaq Dhor Quick Action checkbox alignment

## Scope

V4.2.15.10 is a frontend-only changed-files overlay on V4.2.15.9.

The unified Sabaq Dhor Quick Action now uses a structural two-column layout at every viewport size:

- main quarter / From / To content in the left track;
- one fixed checkbox track on the far right;
- Quarter 2, Quarter 1 and the final To/range checkbox stay in that same right-hand track;
- the generic later `.modal-card label { display:block }` rule can no longer collapse the quarter rows on tablet/desktop;
- mobile retains its proven compact 34px checkbox track.

## Deployment

1. Start from the deployed V4.2.15.9 tree.
2. Overlay the files from `Hifzhelper-v4.2.15.10-changed-files.zip`.
3. Deploy the frontend / Cloudflare Pages build.
4. No Worker deployment is required.
5. No D1 migration is required.

## Verification

- Open Maktab Journal → any student's **Log** action → **Sabaq Dhor**.
- Confirm the quarter checkboxes stay on the far right of their quarter rows.
- Confirm the final To/range checkbox is vertically aligned in the same right-hand column.
- Check mobile, tablet and desktop widths.
- Run: `node tests/verify_v421510_ui.mjs`.
