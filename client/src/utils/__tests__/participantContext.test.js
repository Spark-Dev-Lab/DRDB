import test from "node:test";
import assert from "node:assert/strict";

import { ParticipantTypes } from "../../constants/participantTypes.js";
import { getParticipantContext } from "../participantContext.js";

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

test("frontend helper resolves the child participant contract", () => {
  const context = getParticipantContext({
    study: { ParticipantType: ParticipantTypes.CHILD },
    family,
    child,
  });

  assert.deepEqual(context, {
    participant: child,
    participantName: "Sam Morgan",
    primaryContact: family,
    primaryContactName: "Alex Morgan",
    participantType: ParticipantTypes.CHILD,
  });
});

test("frontend helper resolves an adult without a child", () => {
  const context = getParticipantContext({
    appointment: {
      Study: { ParticipantType: ParticipantTypes.ADULT },
      Family: family,
      Child: null,
    },
  });

  assert.equal(context.participant, family);
  assert.equal(context.participantName, "Alex Morgan");
  assert.equal(context.primaryContact, family);
  assert.equal(context.participantType, ParticipantTypes.ADULT);
});

test("frontend helper defaults legacy studies to Child", () => {
  const context = getParticipantContext({
    appointment: {
      Study: { StudyName: "Legacy study" },
      Child: child,
    },
  });

  assert.equal(context.participant, child);
  assert.equal(context.participantType, ParticipantTypes.CHILD);
});

test("frontend helper does not treat family children as the adult participant", () => {
  const familyWithChildren = {
    ...family,
    Children: [child],
  };
  const context = getParticipantContext({
    study: { ParticipantType: ParticipantTypes.ADULT },
    family: familyWithChildren,
    child,
  });

  assert.equal(context.participant, familyWithChildren);
  assert.equal(context.participantName, "Alex Morgan");
});

test("frontend helper safely handles missing records", () => {
  assert.deepEqual(getParticipantContext(), {
    participant: null,
    participantName: "",
    primaryContact: null,
    primaryContactName: "",
    participantType: ParticipantTypes.CHILD,
  });
});
