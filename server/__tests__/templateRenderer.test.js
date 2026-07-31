const {
  renderParticipantTemplate,
} = require("../api/utils/templateRenderer");

describe("renderParticipantTemplate", () => {
  const participantContext = {
    participantName: "Alex $ Morgan",
    primaryContactName: "Taylor Morgan",
  };

  test("renders generalized participant variables", () => {
    const template =
      "Hello ${{ participantName }}. Contact: ${{primaryContactName}}.";

    expect(
      renderParticipantTemplate(template, participantContext)
    ).toBe("Hello Alex $ Morgan. Contact: Taylor Morgan.");
  });

  test("supports childName as a legacy alias for participantName", () => {
    expect(
      renderParticipantTemplate(
        "${{childName}} / ${{participantName}}",
        participantContext
      )
    ).toBe("Alex $ Morgan / Alex $ Morgan");
  });

  test("replaces every occurrence", () => {
    expect(
      renderParticipantTemplate(
        "${{participantName}} and ${{participantName}}",
        participantContext
      )
    ).toBe("Alex $ Morgan and Alex $ Morgan");
  });

  test("preserves placeholders owned by other renderers", () => {
    expect(
      renderParticipantTemplate(
        "${{participantName}}: ${{ZoomLink}} and ${{he/she}}",
        participantContext
      )
    ).toBe("Alex $ Morgan: ${{ZoomLink}} and ${{he/she}}");
  });

  test("uses empty strings for unavailable names", () => {
    expect(
      renderParticipantTemplate(
        "${{participantName}}|${{primaryContactName}}|${{childName}}"
      )
    ).toBe("||");
  });

  test("handles null templates without throwing", () => {
    expect(renderParticipantTemplate(null, participantContext)).toBe("");
  });
});
