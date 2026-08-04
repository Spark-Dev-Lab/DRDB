const PARTICIPANT_PLACEHOLDERS = Object.freeze({
  participantName: "participantName",
  primaryContactName: "primaryContactName",
  childName: "participantName",
  "he/she": "subjectPronoun",
  "him/her": "objectPronoun",
  "his/her": "possessivePronoun",
});

/**
 * Render participant-related template variables.
 *
 * Unknown placeholders are intentionally preserved so other renderers can
 * handle values such as ZoomLink. childName remains a compatibility alias for
 * participantName.
 */
function renderParticipantTemplate(template, participantContext = {}) {
  if (template === null || template === undefined) {
    return "";
  }

  const values = {
    participantName: participantContext.participantName || "",
    primaryContactName: participantContext.primaryContactName || "",
    subjectPronoun: participantContext.subjectPronoun || "they",
    objectPronoun: participantContext.objectPronoun || "them",
    possessivePronoun: participantContext.possessivePronoun || "their",
  };

  return String(template).replace(
    /\${{\s*(participantName|primaryContactName|childName|he\/she|him\/her|his\/her)\s*}}/g,
    (_placeholder, variableName) =>
      values[PARTICIPANT_PLACEHOLDERS[variableName]]
  );
}

module.exports = {
  renderParticipantTemplate,
};
