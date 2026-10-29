-- SyncLog and SyncRun receive frequent inserts and updates from the external
-- calendar worker. The PostgreSQL defaults wait for roughly 20% dead tuples,
-- which is too late once these relations contain hundreds of thousands of
-- rows. Per-table thresholds keep statistics and reusable space current
-- without changing reservation or cleaning data.
ALTER TABLE "SyncLog" SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_threshold = 1000,
  autovacuum_analyze_scale_factor = 0.01,
  autovacuum_analyze_threshold = 1000
);

ALTER TABLE "SyncRun" SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 500,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_analyze_threshold = 500
);
