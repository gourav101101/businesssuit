# Bulk controls and competitor research

Open **Content library**, select 1–100 local stories, then choose **Bulk edit**. Review the preview selector before saving. This does not publish anything.

- Location line: a visible `📍 Dewas, Madhya Pradesh` line above the published caption. Set or clear it for every selected story. It does not geographically target an audience.
- Native Facebook location: optional numeric Place ID, sent as `place` to the publishing endpoint. Use a genuine Facebook Place ID. Do not assume the destination Page ID is a Place. This is an advanced integration that has not been verified with a live tagged post on your account; Meta may reject a particular Place or omit the tag. No public test posts were created.
- Category changes, case-sensitive literal find-and-replace, caption prefix, hashtags/footer/disclosure. Reapplying the same prefix/footer does not duplicate it.
- Preview each selected story. Changed stories return to review, preserve history, and leave the pending local submission queue. Remote scheduled/published/uncertain posts are protected; edits cannot silently change an existing Facebook schedule.
- Per-story location fields are in the editor. CSV imports/exports support `location` and `place_id`; labelled TXT supports `Location:` and `Place_ID:`. Re-import creates drafts.

## What comparable products offer

Research checked 11 October 2026. Vendor features are not guarantees of what every Facebook endpoint supports.

| Product | Relevant capabilities | What to take from it |
|---|---|---|
| [Buffer](https://buffer.com/publish) | Posting queues, customizable schedules, visual calendar, platform-specific composition | Clear queue states and previews are more useful than hiding API failures. |
| [Buffer calendar](https://support.buffer.com/articles/how-to-use-buffers-calendar-feature-FSSKbH32DN) | Viewing one or several social channels together | A combined multi-Page calendar would make your three-city workflow easier. |
| [SocialPilot bulk scheduling](https://help.socialpilot.co/article/460-how-do-i-schedule-posts-in-bulk) | Bulk import and scheduling; content-library workflow | Improve bulk operations with previews, exact account mapping and preflight checks. |
| [SocialPilot](https://www.socialpilot.co/features/bulk-scheduling-mass-planner) | Advertises batches of up to 500 posts | Product batch size is not a Meta safe-posting quota. Newsdesk retains its 100-item operation limit. |

Meta's [official SDK Page implementation](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/page.py) includes `place` in feed/photo publishing parameters. The developer reference was unavailable during this research; SDK support alone does not verify tagged-post behavior on your Page. The app deliberately keeps the location caption and native tag separate.

## Recommended next releases

1. Combined calendar with a visible destination Page on every item.
2. Saved city-specific caption/hashtag presets, applied explicitly so an Indore story is not automatically relabelled Dewas.
3. Daily volume and duplicate-content preflight checks. User-defined limits should be labelled as workflow preferences, not official Meta limits.
4. Email alerts for expired access, failed queue work and uncertain delivery, after configuring an email provider.
5. Native location verification against a reviewed, user-selected test post before using a Place ID in bulk.

No tool can guarantee reach or prevent account restrictions by posting on a timer. This change does not modify Page permissions or existing remote schedules.

## Implemented next-release additions

**All Pages planner:** open `/planner` from the sidebar. Filter by workspace, status, date and 1/7/30-day range, inspect the connected destination and local queue state, and export the visible agenda as CSV. Same-workspace time collisions are called out. Refresh retrieves current app records; it does not claim to list posts created outside Newsdesk.

**Saved workspace presets:** select stories in Content library, open Bulk edit, configure location/category/prefix/footer and name the preset. Save up to 20 per workspace. Select a saved preset and click Load into preview, review the result, then explicitly save changes to the stories. Preset management alone never changes posts. Exact find-and-replace is excluded from reusable presets to avoid accidental substitutions.

## Bulk native location picker

Select editable stories > Bulk edit > Set Facebook location for selected posts. Search a city/venue or check a numeric Place ID, select the returned location, inspect the preview and Save changes. Approve the changed stories before scheduling. The same Place ID is sent for every selected post. Saved workspace presets can retain it.

Search depends on Meta access for the connected Page; results only include records with location data. If name search is denied, the interface reports it and accepts a known Place ID for lookup. Lookup is not proof that Meta will accept or display the native tag on a post. No live tagged test post has been published. Existing remote schedules remain protected.
