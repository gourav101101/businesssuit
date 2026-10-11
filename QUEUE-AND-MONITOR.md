# Queue and publishing monitor

Bulk scheduling now saves a persistent queue rather than requiring an open browser. The local runner processes one post per workspace each cycle, using existing Page connections. It stops the workspace queue on a rejected or uncertain result. It never automatically retries an uncertain write.

Start the app with `npm run dev`. In a second terminal in the same directory, run `npm run queue`. Both processes must remain running. The browser may close. If the computer sleeps or shuts down, processing stops; pending entries remain in the database. Restart the two commands to continue. This runner is exclusively for the existing loopback development authentication and cannot be used against a hosted production site. Production unattended operation still requires a scheduled Worker or equivalent authenticated job runner.

In Content library, select approved posts and use **Bulk submit to Facebook** to preserve their dates/times. Alternatively choose **Set times / schedule**, set the edition window, then **Schedule all on Facebook**. The connected Page is recorded when enqueueing; changing it does not silently retarget pending items.

Calendar shows pending count, in-flight submission and stopped reasons. **Resume queue** resumes remaining work; **Clear pending queue** removes local pending work without cancelling any Facebook schedules. Pausing submissions also pauses processing. Interrupted deliveries require verification before resuming. If Facebook accepted a write but its remote identifier was not saved, inspect Facebook before attempting to recreate it.

The runner verifies due remote posts when no submission is pending, at most one per workspace per cycle and no more frequently than five minutes for an individual post. Verification errors remain visible rather than being marked as published.

Analytics includes a combined Page agenda and daily status counts. Duplicate warnings compare normalized complete captions and SHA-256 hashes of image files. Old image hashes are backfilled gradually; visually similar, cropped or recompressed images are not necessarily detected. Duplicates are warnings, not automatic policy decisions.

The monitor records Meta usage headers and the latest API error by Page, without tokens. Missing headers are not treated as an unlimited quota. A rejected submission stops its queue. Current queue processing does not predict Meta's unpublished anti-spam thresholds or guarantee policy compliance.

**Add AI disclosure** appends an illustration disclosure to selected captions through the existing bulk edit flow. It resets approval. Use it only for generated illustrations; it is not proof of factual accuracy or a substitute for Meta's platform AI labels.

Import preview already supports ZIP/TXT/CSV image matches, placeholder and duplicate-caption warnings, editable dates and times, missing-image warnings and draft-only imports.

Validation: TypeScript; existing 13 domain tests; three queue tests covering concurrent claims, uncertain-write stopping and clearing pending work; local authenticated monitoring plus authentication, cross-origin and invalid-entry checks. No new real content was published for testing these additions.
