-- Family brochure/flyer tracking fields
--
-- Run against the target DRDB schema:
--   USE `DRDB`;
--   SOURCE add_brochure_tracking.sql;
--
-- Safe to run more than once.

SET @has_brochure_seen = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Family'
    AND COLUMN_NAME = 'BrochureSeen'
);
SET @sql = IF(
  @has_brochure_seen = 0,
  'ALTER TABLE `Family` ADD COLUMN `BrochureSeen` VARCHAR(50) NULL AFTER `RecruitmentMethod`',
  'SELECT ''Family.BrochureSeen already exists'' AS status'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_brochure_location = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Family'
    AND COLUMN_NAME = 'BrochureLocation'
);
SET @sql = IF(
  @has_brochure_location = 0,
  'ALTER TABLE `Family` ADD COLUMN `BrochureLocation` TEXT NULL AFTER `BrochureSeen`',
  'SELECT ''Family.BrochureLocation already exists'' AS status'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
