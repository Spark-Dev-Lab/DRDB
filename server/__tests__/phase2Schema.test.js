const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize");

const ParticipantTypes = require("../api/utils/participantTypes");
const defineStudy = require("../api/models/SequelizeAuto/Study");
const defineAppointment = require("../api/models/SequelizeAuto/Appointment");
const defineFamily = require("../api/models/SequelizeAuto/Family");
const defineChild = require("../api/models/SequelizeAuto/Child");

function captureAttributes(modelFactory) {
  const sequelize = {
    define: jest.fn((_name, attributes) => ({ attributes })),
    literal: jest.fn((value) => value),
  };

  return modelFactory(sequelize, Sequelize.DataTypes).attributes;
}

describe("Phase 2 ORM schema", () => {
  test("Study.ParticipantType is a required Child/Adult enum defaulting to Child", () => {
    const attributes = captureAttributes(defineStudy);
    const participantType = attributes.ParticipantType;

    expect(participantType.allowNull).toBe(false);
    expect(participantType.defaultValue).toBe(ParticipantTypes.CHILD);
    expect(participantType.type.values).toEqual([
      ParticipantTypes.CHILD,
      ParticipantTypes.ADULT,
    ]);
  });

  test("Appointment requires a Family but permits a null Child", () => {
    const attributes = captureAttributes(defineAppointment);

    expect(attributes.FK_Family.allowNull).toBe(false);
    expect(attributes.FK_Child.allowNull).toBe(true);
  });

  test("Family supports an optional primary-contact birthdate", () => {
    const attributes = captureAttributes(defineFamily);

    expect(attributes.DoBPrimary.allowNull).toBe(true);
    expect(attributes.DoBPrimary.type).toEqual(Sequelize.DataTypes.DATEONLY);
  });

  test("Family supports optional contact gender identity fields", () => {
    const attributes = captureAttributes(defineFamily);

    expect(attributes.PrimaryGenderIdentity.allowNull).toBe(true);
    expect(attributes.SecondaryGenderIdentity.allowNull).toBe(true);
  });

  test("Study participant health criteria support Not Applicable", () => {
    const attributes = captureAttributes(defineStudy);
    const expectedValues = ["Include", "Exclude", "Only", "Not Applicable"];

    expect(attributes.ASDParticipant.type.values).toEqual(expectedValues);
    expect(attributes.PrematureParticipant.type.values).toEqual(expectedValues);
    expect(attributes.VisionLossParticipant.type.values).toEqual(expectedValues);
    expect(attributes.HearingLossParticipant.type.values).toEqual(expectedValues);
    expect(attributes.IllParticipant.type.values).toEqual(expectedValues);
  });

  test("Child.Gender supports full gender identity text", () => {
    const attributes = captureAttributes(defineChild);

    expect(attributes.Gender.allowNull).toBe(true);
    expect(attributes.Gender.type.options.length).toBe(50);
  });
});

describe("Phase 2 SQL schemas", () => {
  const migration = fs.readFileSync(
    path.join(__dirname, "../../MySQL/adult_participant_phase2.sql"),
    "utf8"
  );
  const template = fs.readFileSync(
    path.join(__dirname, "../../MySQL/Template.sql"),
    "utf8"
  );

  test("migration adds ParticipantType with a legacy-safe Child default", () => {
    expect(migration).toMatch(
      /ADD COLUMN `ParticipantType` ENUM\(''Child'', ''Adult''\) NOT NULL DEFAULT ''Child''/
    );
  });

  test("migration makes FK_Child nullable and adds DoBPrimary", () => {
    expect(migration).toMatch(
      /MODIFY COLUMN `FK_Child` INT NULL/
    );
    expect(migration).toMatch(
      /ADD COLUMN `DoBPrimary` DATE NULL/
    );
    expect(migration).toMatch(
      /ADD COLUMN `PrimaryGenderIdentity` VARCHAR\(50\) NULL/
    );
    expect(migration).toMatch(
      /ADD COLUMN `SecondaryGenderIdentity` VARCHAR\(50\) NULL/
    );
    expect(migration).toMatch(
      /MODIFY COLUMN `Gender` VARCHAR\(50\) NULL/
    );
    expect(migration).toMatch(
      /MODIFY COLUMN `ASDParticipant` ENUM\('Include','Exclude','Only','Not Applicable'\)/
    );
  });

  test("fresh-install template contains all Phase 2 columns", () => {
    expect(template).toMatch(
      /`ParticipantType` enum\('Child','Adult'\) NOT NULL DEFAULT 'Child'/
    );
    expect(template).toMatch(/`FK_Child` int DEFAULT NULL/);
    expect(template).toMatch(/`DoBPrimary` date DEFAULT NULL/);
    expect(template).toMatch(/`PrimaryGenderIdentity` varchar\(50\) DEFAULT NULL/);
    expect(template).toMatch(/`SecondaryGenderIdentity` varchar\(50\) DEFAULT NULL/);
    expect(template).toMatch(/`Gender` varchar\(50\) DEFAULT NULL/);
    expect(template).toMatch(/`ASDParticipant` enum\('Include','Exclude','Only','Not Applicable'\) NOT NULL DEFAULT 'Include'/);
  });
});
