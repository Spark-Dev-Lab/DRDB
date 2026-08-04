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

  return {
    participant,
    participantName:
      participantType === ParticipantTypes.ADULT
        ? resolvedFamily?.NamePrimary || ""
        : resolvedChild?.Name || "",
    primaryContact: resolvedFamily,
    primaryContactName: resolvedFamily?.NamePrimary || "",
    participantType,
  };
}
