-- Family contact preference fields
--
-- Run against the target DRDB schema:
--   USE `DRDB`;
--   SOURCE add_contact_preferences.sql;
--
-- Safe to run more than once.

SET @has_preferred_contact_methods = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Family'
    AND COLUMN_NAME = 'PreferredContactMethods'
);
SET @sql = IF(
  @has_preferred_contact_methods = 0,
  'ALTER TABLE `Family` ADD COLUMN `PreferredContactMethods` TEXT NULL AFTER `Note`',
  'SELECT ''Family.PreferredContactMethods already exists'' AS status'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_preferred_contact_time = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Family'
    AND COLUMN_NAME = 'PreferredContactTime'
);
SET @sql = IF(
  @has_preferred_contact_time = 0,
  'ALTER TABLE `Family` ADD COLUMN `PreferredContactTime` VARCHAR(255) NULL AFTER `PreferredContactMethods`',
  'SELECT ''Family.PreferredContactTime already exists'' AS status'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_preferred_contact_notes = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Family'
    AND COLUMN_NAME = 'PreferredContactNotes'
);
SET @sql = IF(
  @has_preferred_contact_notes = 0,
  'ALTER TABLE `Family` ADD COLUMN `PreferredContactNotes` TEXT NULL AFTER `PreferredContactTime`',
  'SELECT ''Family.PreferredContactNotes already exists'' AS status'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
