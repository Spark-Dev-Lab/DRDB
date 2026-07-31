const PARTICIPANT_PLACEHOLDERS = Object.freeze({
  participantName: "participantName",
  primaryContactName: "primaryContactName",
  childName: "participantName",
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
  };

  return String(template).replace(
    /\${{\s*(participantName|primaryContactName|childName)\s*}}/g,
    (_placeholder, variableName) =>
      values[PARTICIPANT_PLACEHOLDERS[variableName]]
  );
}

module.exports = {
  renderParticipantTemplate,
};
