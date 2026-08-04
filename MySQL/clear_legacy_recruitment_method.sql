-- Clear the legacy "Community Contact Form" recruitment value from all existing records.
-- This was a generic import bucket, not an actual recruitment pathway.
-- Records can be re-tagged individually once the true pathway is known.

UPDATE `Family`
SET `RecruitmentMethod` = NULL
WHERE `RecruitmentMethod` = 'Community Contact Form'
   OR `RecruitmentMethod` = '["CommunityContactForm"]'
   OR `RecruitmentMethod` = 'CommunityContactForm';
