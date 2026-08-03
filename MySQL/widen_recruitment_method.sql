-- Widen RecruitmentMethod to TEXT to support JSON arrays of multiple pathways,
-- and drop the "Hospital" default since it no longer applies.
--
-- Safe to run more than once.

SET @has_recruitment_method = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Family'
    AND COLUMN_NAME = 'RecruitmentMethod'
);
SET @sql = IF(
  @has_recruitment_method > 0,
  'ALTER TABLE `Family` MODIFY COLUMN `RecruitmentMethod` TEXT NULL DEFAULT NULL',
  'SELECT ''Family.RecruitmentMethod does not exist'' AS status'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
