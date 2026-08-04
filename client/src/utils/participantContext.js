import { ParticipantTypes } from "../constants/participantTypes.js";

function resolveStudy({ study, appointment, schedule }) {
  return study || appointment?.Study || schedule?.Study || null;
}

function resolveFamily({ family, child, appointment, schedule }) {
  return (
    family ||
    appointment?.Family ||
    schedule?.Family ||
    child?.Family ||
    appointment?.Child?.Family ||
    null
  );
}

function resolveChild({ child, appointment }) {
  return child || appointment?.Child || null;
}

function normalizeGenderIdentity(value) {
  return (value || "").trim().toLowerCase();
}

function pronounsFromGenderIdentity(genderIdentity) {
  const normalized = normalizeGenderIdentity(genderIdentity);

  if (["woman", "female", "girl", "f"].includes(normalized)) {
    return { subjectPronoun: "she", objectPronoun: "her", possessivePronoun: "her" };
  }

  if (["man", "male", "boy", "m"].includes(normalized)) {
    return { subjectPronoun: "he", objectPronoun: "him", possessivePronoun: "his" };
  }

  if (
    [
      "non-binary",
      "nonbinary",
      "genderqueer",
      "gender fluid",
      "gender-fluid",
      "agender",
      "they/them",
      "they",
      "nb",
      "x",
    ].includes(normalized)
  ) {
    return { subjectPronoun: "they", objectPronoun: "them", possessivePronoun: "their" };
  }

  return null;
}

function pronounsFromParticipant({ participantType, family, child }) {
  if (participantType === ParticipantTypes.ADULT) {
    return (
      pronounsFromGenderIdentity(family?.PrimaryGenderIdentity) ||
      { subjectPronoun: "they", objectPronoun: "them", possessivePronoun: "their" }
    );
  }

  return (
    pronounsFromGenderIdentity(child?.Gender) ||
    pronounsFromGenderIdentity(child?.Sex) ||
    { subjectPronoun: "they", objectPronoun: "them", possessivePronoun: "their" }
  );
}

/**
 * Lightweight frontend mirror of the backend participant-context contract.
 */
export function getParticipantContext({
  study = null,
  family = null,
  child = null,
  appointment = null,
  schedule = null,
} = {}) {
  const resolvedStudy = resolveStudy({ study, appointment, schedule });
  const resolvedChild = resolveChild({ child, appointment });
  const resolvedFamily = resolveFamily({
    family,
    child: resolvedChild,
    appointment,
    schedule,
  });
  const participantType =
    resolvedStudy?.ParticipantType === ParticipantTypes.ADULT
      ? ParticipantTypes.ADULT
      : ParticipantTypes.CHILD;
  const participant =
    participantType === ParticipantTypes.ADULT
      ? resolvedFamily
      : resolvedChild;
  const pronouns = pronounsFromParticipant({
    participantType,
    family: resolvedFamily,
    child: resolvedChild,
  });

  return {
    participant,
    participantName:
      participantType === ParticipantTypes.ADULT
        ? resolvedFamily?.NamePrimary || ""
        : resolvedChild?.Name || "",
    primaryContact: resolvedFamily,
    primaryContactName: resolvedFamily?.NamePrimary || "",
    participantType,
    ...pronouns,
  };
}
