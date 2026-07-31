const ParticipantTypes = require("../api/utils/participantTypes");
const {
  validateAppointmentParticipantRequirements,
} = require("../api/services/scheduleService");

describe("participant validation rules", () => {
  test("allows missing FK_Child for child studies", () => {
    const participantTypeByStudyId = new Map([[1, ParticipantTypes.CHILD]]);

    expect(() =>
      validateAppointmentParticipantRequirements(
        [{ FK_Study: 1, FK_Family: 10, FK_Child: null }],
        participantTypeByStudyId
      )
    ).not.toThrow();
  });

  test("allows null FK_Child for adult studies", () => {
    const participantTypeByStudyId = new Map([[2, ParticipantTypes.ADULT]]);

    expect(() =>
      validateAppointmentParticipantRequirements(
        [{ FK_Study: 2, FK_Family: 10, FK_Child: null }],
        participantTypeByStudyId
      )
    ).not.toThrow();
  });

  test("accepts default schedule family id when appointment FK_Family is omitted", () => {
    const participantTypeByStudyId = new Map([[1, ParticipantTypes.CHILD]]);

    expect(() =>
      validateAppointmentParticipantRequirements(
        [{ FK_Study: 1, FK_Child: 42 }],
        participantTypeByStudyId,
        { defaultFamilyId: 99 }
      )
    ).not.toThrow();
  });

  test("fails when neither appointment FK_Family nor default family id is available", () => {
    const participantTypeByStudyId = new Map([[2, ParticipantTypes.ADULT]]);

    expect(() =>
      validateAppointmentParticipantRequirements(
        [{ FK_Study: 2, FK_Child: null }],
        participantTypeByStudyId
      )
    ).toThrow("missing a valid FK_Family");
  });

  test("fails when study is missing from lookup", () => {
    const participantTypeByStudyId = new Map();

    expect(() =>
      validateAppointmentParticipantRequirements(
        [{ FK_Study: 999, FK_Family: 10, FK_Child: null }],
        participantTypeByStudyId
      )
    ).toThrow("was not found");
  });
});
