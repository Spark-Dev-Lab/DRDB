-- Add health/screening criteria to the Family table for adult participant records.
-- Child records already have these fields; this mirrors them at the family level.
-- Safe to run more than once.

SET @has_asd = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Family' AND COLUMN_NAME = 'ASD');
SET @sql = IF(@has_asd = 0,
  'ALTER TABLE `Family` ADD COLUMN `ASD` INTEGER NULL DEFAULT 0 AFTER `AutismHistory`',
  'SELECT ''Family.ASD already exists'' AS status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_hearing = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Family' AND COLUMN_NAME = 'HearingLoss');
SET @sql = IF(@has_hearing = 0,
  'ALTER TABLE `Family` ADD COLUMN `HearingLoss` INTEGER NULL DEFAULT 0 AFTER `ASD`',
  'SELECT ''Family.HearingLoss already exists'' AS status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_vision = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Family' AND COLUMN_NAME = 'VisionLoss');
SET @sql = IF(@has_vision = 0,
  'ALTER TABLE `Family` ADD COLUMN `VisionLoss` INTEGER NULL DEFAULT 0 AFTER `HearingLoss`',
  'SELECT ''Family.VisionLoss already exists'' AS status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_premature = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Family' AND COLUMN_NAME = 'PrematureBirth');
SET @sql = IF(@has_premature = 0,
  'ALTER TABLE `Family` ADD COLUMN `PrematureBirth` INTEGER NULL DEFAULT 0 AFTER `VisionLoss`',
  'SELECT ''Family.PrematureBirth already exists'' AS status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_illness = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Family' AND COLUMN_NAME = 'Illness');
SET @sql = IF(@has_illness = 0,
  'ALTER TABLE `Family` ADD COLUMN `Illness` INTEGER NULL DEFAULT 0 AFTER `PrematureBirth`',
  'SELECT ''Family.Illness already exists'' AS status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
