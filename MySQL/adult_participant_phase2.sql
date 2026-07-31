-- DRDB Adult Participant Extension - Phase 2
--
-- Run this migration against the target DRDB schema before deploying the
-- Phase 2 application code. Select the schema first, for example:
--
--   USE `DRDB`;
--
-- The migration is safe to run more than once.

-- Study.ParticipantType expresses the minimum participant information
-- required by a study. Existing studies remain child studies.
SET @has_participant_type = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Study'
    AND COLUMN_NAME = 'ParticipantType'
);
SET @phase2_sql = IF(
  @has_participant_type = 0,
  'ALTER TABLE `Study` ADD COLUMN `ParticipantType` ENUM(''Child'', ''Adult'') NOT NULL DEFAULT ''Child'' AFTER `StudyType`',
  'SELECT ''Study.ParticipantType already exists'' AS phase2_status'
);
PREPARE phase2_statement FROM @phase2_sql;
EXECUTE phase2_statement;
DEALLOCATE PREPARE phase2_statement;

-- Participant health criteria now support a "Not Applicable" option.
ALTER TABLE `Study`
  MODIFY COLUMN `ASDParticipant` ENUM('Include','Exclude','Only','Not Applicable') NOT NULL DEFAULT 'Include',
  MODIFY COLUMN `PrematureParticipant` ENUM('Include','Exclude','Only','Not Applicable') NOT NULL DEFAULT 'Include',
  MODIFY COLUMN `VisionLossParticipant` ENUM('Include','Exclude','Only','Not Applicable') NOT NULL DEFAULT 'Include',
  MODIFY COLUMN `HearingLossParticipant` ENUM('Include','Exclude','Only','Not Applicable') NOT NULL DEFAULT 'Include',
  MODIFY COLUMN `IllParticipant` ENUM('Include','Exclude','Only','Not Applicable') NOT NULL DEFAULT 'Include';

-- Household contact gender identity fields.
SET @has_primary_gender_identity = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Family'
    AND COLUMN_NAME = 'PrimaryGenderIdentity'
);
SET @phase2_sql = IF(
  @has_primary_gender_identity = 0,
  'ALTER TABLE `Family` ADD COLUMN `PrimaryGenderIdentity` VARCHAR(50) NULL AFTER `NamePrimary`',
  'SELECT ''Family.PrimaryGenderIdentity already exists'' AS phase2_status'
);
PREPARE phase2_statement FROM @phase2_sql;
EXECUTE phase2_statement;
DEALLOCATE PREPARE phase2_statement;

SET @has_secondary_gender_identity = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Family'
    AND COLUMN_NAME = 'SecondaryGenderIdentity'
);
SET @phase2_sql = IF(
  @has_secondary_gender_identity = 0,
  'ALTER TABLE `Family` ADD COLUMN `SecondaryGenderIdentity` VARCHAR(50) NULL AFTER `NameSecondary`',
  'SELECT ''Family.SecondaryGenderIdentity already exists'' AS phase2_status'
);
PREPARE phase2_statement FROM @phase2_sql;
EXECUTE phase2_statement;
DEALLOCATE PREPARE phase2_statement;

-- Child gender identity value storage.
SET @has_child_gender = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Child'
    AND COLUMN_NAME = 'Gender'
);
SET @phase2_sql = IF(
  @has_child_gender = 0,
  'ALTER TABLE `Child` ADD COLUMN `Gender` VARCHAR(50) NULL AFTER `Sex`',
  'SELECT ''Child.Gender already exists'' AS phase2_status'
);
PREPARE phase2_statement FROM @phase2_sql;
EXECUTE phase2_statement;
DEALLOCATE PREPARE phase2_statement;

SET @child_gender_type = (
  SELECT COLUMN_TYPE
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Child'
    AND COLUMN_NAME = 'Gender'
  LIMIT 1
);
SET @phase2_sql = IF(
  @child_gender_type = 'varchar(1)',
  'ALTER TABLE `Child` MODIFY COLUMN `Gender` VARCHAR(50) NULL',
  'SELECT ''Child.Gender already supports long values'' AS phase2_status'
);
PREPARE phase2_statement FROM @phase2_sql;
EXECUTE phase2_statement;
DEALLOCATE PREPARE phase2_statement;

-- Adult appointments remain linked to a household (internally Family), but
-- they do not require a Child record.
SET @fk_child_is_nullable = (
  SELECT IS_NULLABLE
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Appointment'
    AND COLUMN_NAME = 'FK_Child'
  LIMIT 1
);
SET @phase2_sql = IF(
  @fk_child_is_nullable = 'YES',
  'SELECT ''Appointment.FK_Child is already nullable'' AS phase2_status',
  'ALTER TABLE `Appointment` MODIFY COLUMN `FK_Child` INT NULL'
);
PREPARE phase2_statement FROM @phase2_sql;
EXECUTE phase2_statement;
DEALLOCATE PREPARE phase2_statement;

-- Approved household extension used for adult age eligibility.
SET @has_primary_contact_dob = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Family'
    AND COLUMN_NAME = 'DoBPrimary'
);
SET @phase2_sql = IF(
  @has_primary_contact_dob = 0,
  'ALTER TABLE `Family` ADD COLUMN `DoBPrimary` DATE NULL AFTER `NamePrimary`',
  'SELECT ''Family.DoBPrimary already exists'' AS phase2_status'
);
PREPARE phase2_statement FROM @phase2_sql;
EXECUTE phase2_statement;
DEALLOCATE PREPARE phase2_statement;

-- Verification
SELECT
  TABLE_NAME,
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND (
    (TABLE_NAME = 'Study' AND COLUMN_NAME = 'ParticipantType')
    OR (TABLE_NAME = 'Appointment' AND COLUMN_NAME = 'FK_Child')
    OR (TABLE_NAME = 'Family' AND COLUMN_NAME = 'DoBPrimary')
    OR (TABLE_NAME = 'Family' AND COLUMN_NAME = 'PrimaryGenderIdentity')
    OR (TABLE_NAME = 'Family' AND COLUMN_NAME = 'SecondaryGenderIdentity')
    OR (TABLE_NAME = 'Child' AND COLUMN_NAME = 'Gender')
    OR (TABLE_NAME = 'Study' AND COLUMN_NAME = 'ASDParticipant')
    OR (TABLE_NAME = 'Study' AND COLUMN_NAME = 'PrematureParticipant')
    OR (TABLE_NAME = 'Study' AND COLUMN_NAME = 'VisionLossParticipant')
    OR (TABLE_NAME = 'Study' AND COLUMN_NAME = 'HearingLossParticipant')
    OR (TABLE_NAME = 'Study' AND COLUMN_NAME = 'IllParticipant')
  )
ORDER BY TABLE_NAME, COLUMN_NAME;
