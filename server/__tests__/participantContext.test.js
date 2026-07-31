const ParticipantTypes = require("../api/utils/participantTypes");
const {
  getParticipantContext,
} = require("../api/utils/participantContext");

describe("getParticipantContext", () => {
  const family = {
    id: 10,
    NamePrimary: "Alex Morgan",
    Children: [],
  };
  const child = {
    id: 20,
    Name: "Sam Morgan",
    Family: family,
  };

  test("resolves a child study participant and primary contact", () => {
    const context = getParticipantContext({
      study: { ParticipantType: ParticipantTypes.CHILD },
      family,
      child,
    });

    expect(context).toEqual({
      participant: child,
      participantName: "Sam Morgan",
      primaryContact: family,
      primaryContactName: "Alex Morgan",
      participantType: ParticipantTypes.CHILD,
    });
  });

  test("defaults legacy studies without ParticipantType to Child", () => {
    const context = getParticipantContext({
      study: { StudyName: "Legacy study" },
      family,
      child,
    });

    expect(context.participant).toBe(child);
    expect(context.participantType).toBe(ParticipantTypes.CHILD);
  });

  test("resolves the family primary contact for an adult study without a child", () => {
    const context = getParticipantContext({
      study: { ParticipantType: ParticipantTypes.ADULT },
      family,
    });

    expect(context).toEqual({
      participant: family,
      participantName: "Alex Morgan",
      primaryContact: family,
      primaryContactName: "Alex Morgan",
      participantType: ParticipantTypes.ADULT,
    });
  });

  test("keeps the adult as participant when the family also has children", () => {
    const familyWithChildren = {
      ...family,
      Children: [child],
    };
    const context = getParticipantContext({
      study: { ParticipantType: ParticipantTypes.ADULT },
      family: familyWithChildren,
      child,
    });

    expect(context.participant).toBe(familyWithChildren);
    expect(context.participantName).toBe("Alex Morgan");
    expect(context.participantType).toBe(ParticipantTypes.ADULT);
  });

  test("resolves related records from an appointment", () => {
    const appointment = {
      Study: { ParticipantType: ParticipantTypes.CHILD },
      Family: family,
      Child: child,
    };

    const context = getParticipantContext({ appointment });

    expect(context.participant).toBe(child);
    expect(context.primaryContact).toBe(family);
  });

  test("resolves the family from a schedule when an adult appointment has no child", () => {
    const context = getParticipantContext({
      appointment: {
        Study: { ParticipantType: ParticipantTypes.ADULT },
        Child: null,
      },
      schedule: { Family: family },
    });

    expect(context.participant).toBe(family);
    expect(context.primaryContact).toBe(family);
  });

  test("returns a stable empty child context when records are missing", () => {
    expect(getParticipantContext()).toEqual({
      participant: null,
      participantName: "",
      primaryContact: null,
      primaryContactName: "",
      participantType: ParticipantTypes.CHILD,
    });
  });

  test("does not mutate its inputs", () => {
    const originalFamily = { id: 10, NamePrimary: "" };
    const originalChild = { id: 20, Name: "" };

    getParticipantContext({
      study: { ParticipantType: ParticipantTypes.CHILD },
      family: originalFamily,
      child: originalChild,
    });

    expect(originalFamily).toEqual({ id: 10, NamePrimary: "" });
    expect(originalChild).toEqual({ id: 20, Name: "" });
  });
});
