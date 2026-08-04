/**
 * Family Service
 *
 * Business logic for family batch imports, deduplication, and sibling management.
 * Also houses the shared Sequelize include definition used by multiple search handlers.
 * Extracted from controllers/family.js for maintainability.
 */

const model = require("../models/DRDB");
const { Op } = require("sequelize");

const ALPHABET = "abcdefghijk".split("");

// Maps loose Google Form text to canonical values using substring matching.
// Options contain commas internally, so we never split on commas.
const RECRUITMENT_MAP = [
  { key: "CommunityEvent",        pattern: "community event" },
  { key: "OberlinKidsReferral",   pattern: "oberlinkids referral" },
  { key: "SocialMedia",           pattern: "social media" },
  { key: "Lab website",           pattern: "lab website" },
  { key: "PreviousParticipation", pattern: "previous participation" },
  { key: "Other",                 pattern: "other" },
];

const BROCHURE_LOCATION_MAP = [
  { key: "Bulletin board / community location", pattern: "local bulletin board" },
  { key: "Intake packet / pamphlet",            pattern: "intake packet" },
  { key: "Received in the mail",                pattern: "received in the mail" },
  { key: "Given by another person",             pattern: "given to me by another person" },
  { key: "Other",                               pattern: "other" },
];

function normalizeByMap(raw, map) {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const matched = map.filter(({ pattern }) => lower.includes(pattern)).map(({ key }) => key);
  return matched.length ? JSON.stringify([...new Set(matched)]) : null;
}

function normalizeRecruitmentMethod(raw) {
  return normalizeByMap(raw, RECRUITMENT_MAP);
}

function normalizeBrochureLocation(raw) {
  return normalizeByMap(raw, BROCHURE_LOCATION_MAP);
}

// ─── Shared Sequelize include blocks ─────────────────────────────

/**
 * Returns the standard include block for child queries.
 * Used by family search and followup search.
 */
function childInclude() {
  return {
    model: model.child,
    separate: true,
    include: [
      {
        model: model.appointment,
        attributes: ["FK_Study"],
      },
      {
        model: model.family,
        attributes: ["AutismHistory"],
      },
    ],
    order: [["id", "DESC"]],
  };
}

/**
 * Returns the standard appointment include block with study, lab, and experimenter joins.
 * Used inside schedule includes for family search and followup search.
 */
function appointmentInclude() {
  return {
    model: model.appointment,
    separate: true,
    include: [
      {
        model: model.child,
        include: [
          {
            model: model.appointment,
            attributes: ["FK_Study"],
          },
          {
            model: model.family,
            attributes: ["AutismHistory"],
          },
        ],
      },
      {
        model: model.study,
        include: [
          { model: model.lab },
          {
            model: model.personnel,
            as: "Experimenters",
            through: {
              model: model.experimenter,
            },
          },
        ],
      },
      {
        model: model.personnel,
        as: "PrimaryExperimenter",
        through: { model: model.experimenterAssignment },
        attributes: [
          "id",
          "Name",
          "Email",
          "Calendar",
          "ZoomLink",
          "Initial",
        ],
      },
      {
        model: model.personnel,
        as: "SecondaryExperimenter",
        through: { model: model.experimenterAssignment_2nd },
        attributes: [
          "id",
          "Name",
          "Email",
          "Calendar",
          "ZoomLink",
          "Initial",
        ],
      },
    ],
  };
}

/**
 * Returns the full schedule include block used by family search.
 * @param {boolean} [separateSchedule=true] - Whether to use separate: true for the schedule query
 */
function scheduleInclude(separateSchedule = true) {
  return {
    model: model.schedule,
    separate: separateSchedule,
    order: [["id", "DESC"]],
    include: [
      {
        model: model.family,
        include: [
          {
            model: model.child,
            include: [
              {
                model: model.appointment,
                attributes: ["FK_Study"],
              },
              {
                model: model.family,
                attributes: ["AutismHistory"],
              },
            ],
          },
        ],
      },
      {
        model: model.personnel,
      },
      appointmentInclude(),
    ],
  };
}

// ─── Batch import logic ─────────────────────────────────────────

function containsObject(obj, array) {
  for (var i = 0; i < array.length; i++) {
    if (
      array[i].FK_Child === obj.FK_Child &&
      array[i].Sibling === obj.Sibling
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Import families in batch, with deduplication and sibling assignment.
 *
 * @param {Array} newFamilies - Array of family records (from CSV upload)
 * @returns {{ doubleCheckList, nOfSkip, nOfAdded, skipList }}
 */
async function batchImportFamilies(newFamilies) {
  var doubleCheckList = [];
  var skipList = [];
  var skipImport = false;
  var nOfSkip = 0;
  var nOfAdded = 0;

  for (var i = 0; i < newFamilies.length; i++) {
    var child = {};
    child.Name = newFamilies[i].Name;
    child.Sex = newFamilies[i].Sex;
    child.Gender = newFamilies[i].Gender;
    child.DoB = newFamilies[i].DoB;
    child.Age = newFamilies[i].Age;
    child.Note = newFamilies[i].Notes;
    child.BirthWeight = newFamilies[i].BirthWeight;
    child.Gestation = newFamilies[i].Gestation;
    child.HearingLoss = newFamilies[i].HearingLoss;
    child.VisionLoss = newFamilies[i].VisionLoss;
    child.RecruitmentMethod = newFamilies[i].RecruitmentMethod;

    const phone = newFamilies[i].Phone;
    const email = newFamilies[i].Email;

    var searchString = [];

    if (phone && phone != "") {
      searchString.push({ Phone: phone });
    }
    if (email && email != "") {
      searchString.push({ Email: email });
    }

    var family = await model.family.findOne({
      where: {
        [Op.or]: searchString,
      },
      include: [model.child],
    });

    var newFamily;

    if (!!family) {
      // Family exists — check for duplicates
      if ("DoB" in newFamilies[i]) {
        family.Children.forEach((existingChild) => {
          if (existingChild.DoB == child.DoB) {
            if (existingChild.Name == child.Name) {
              skipImport = true;
              nOfSkip += 1;
              skipList.push({
                Email: family.Email,
                Name: child.Name,
                DoB: child.DoB,
              });
            } else {
              doubleCheckList.push({
                FK_Family: family.id,
                Email: family.Email,
                childID: existingChild.id,
              });
            }
          }
        });

        if (!skipImport) {
          child.FK_Family = family.id;
          await model.child.create(child);

          newFamily = await model.family.findOne({
            where: { id: family.id },
            include: [model.child],
          });
        }
      } else {
        skipImport = true;
      }
    } else {
      // New family
      family = await model.family.create(newFamilies[i]);

      if ("DoB" in newFamilies[i]) {
        child.FK_Family = family.id;
        child.IdWithinFamily = ALPHABET[0];

        await model.child.create(child);

        newFamily = await model.family.findOne({
          where: { id: family.id },
          include: [model.child],
        });
      } else {
        skipImport = true;
      }
    }

    // Update sibling table & assign child IDs within family
    if (!skipImport) {
      if (newFamily.Children.length > 1) {
        var Children = newFamily.Children;
        var siblings = [];
        var children = [];

        for (var j = 0; j < Children.length; j++) {
          var childId = Children[j].id;

          Children.forEach((sibling) => {
            if (sibling.id != childId) {
              siblings.push({ FK_Child: childId, Sibling: sibling.id });
            }
          });

          children.push(childId);

          if (Children[j].IdWithinFamily == null) {
            Children[j].IdWithinFamily = ALPHABET[j];

            await model.child.update(
              { IdWithinFamily: ALPHABET[j] },
              { where: { id: childId } }
            );
          }
        }

        var existingSibling = await model.sibling.findAll({
          attributes: ["FK_Child", "Sibling"],
          where: {
            FK_Child: { [Op.in]: children },
          },
        });

        var filteredSiblings = siblings.filter(function (value) {
          return !containsObject(value, existingSibling);
        });

        await model.sibling.bulkCreate(filteredSiblings);
      }
    }

    if (skipImport) {
      skipImport = false;
    } else {
      nOfAdded += 1;
    }
  }

  doubleCheckList = doubleCheckList.filter(
    (item, index, self) =>
      index === self.findIndex((t) => t.FK_Family === item.FK_Family)
  );

  return {
    doubleCheckList,
    nOfSkip,
    nOfAdded,
    skipList,
  };
}

/**
 * Import records parsed from the Oberlin intake form.
 * Each record has { family, children[] }.
 */
async function importIntakeForms(records) {
  let nOfAdded = 0;
  let nOfSkip = 0;
  const skipList = [];
  const doubleCheckList = [];

  for (const record of records) {
    const { family, children } = record;
    const searchString = [];
    if (family.Phone) searchString.push({ Phone: family.Phone });
    if (family.Email) searchString.push({ Email: family.Email });
    if (!searchString.length) { nOfSkip += 1; continue; }

    let existingFamily = await model.family.findOne({
      where: { [Op.or]: searchString },
      include: [model.child],
    });

    let savedFamily;
    if (existingFamily) {
      // Update secondary name/DoB if not already set
      const updates = {};
      if (!existingFamily.NameSecondary && family.NameSecondary) updates.NameSecondary = family.NameSecondary;
      if (!existingFamily.DoBPrimary && family.DoBPrimary) updates.DoBPrimary = family.DoBPrimary;
      if (!existingFamily.AssignedLab && family.AssignedLab) updates.AssignedLab = family.AssignedLab;
      // Always overwrite contact preferences and recruitment info from the form
      if (family.PreferredContactMethods) updates.PreferredContactMethods = family.PreferredContactMethods;
      if (family.PreferredContactTime) updates.PreferredContactTime = family.PreferredContactTime;
      if (family.PreferredContactNotes) updates.PreferredContactNotes = family.PreferredContactNotes;
      if (family.RecruitmentMethod) updates.RecruitmentMethod = normalizeRecruitmentMethod(family.RecruitmentMethod);
      if (family.BrochureSeen) updates.BrochureSeen = family.BrochureSeen;
      if (family.BrochureLocation) updates.BrochureLocation = normalizeBrochureLocation(family.BrochureLocation);
      if (Object.keys(updates).length) await existingFamily.update(updates);
      savedFamily = existingFamily;
    } else {
      const familyData = { ...family };
      delete familyData.DoBSecondary;
      if (familyData.RecruitmentMethod) {
        familyData.RecruitmentMethod = normalizeRecruitmentMethod(familyData.RecruitmentMethod);
      }
      if (familyData.BrochureLocation) {
        familyData.BrochureLocation = normalizeBrochureLocation(familyData.BrochureLocation);
      }
      savedFamily = await model.family.create(familyData);
    }

    // Add children not already present (deduplicate by Name+DoB)
    const existingChildren = savedFamily.Children || [];
    let addedAny = false;
    for (const child of children) {
      if (!child.Name && !child.DoB) continue;
      const isDuplicate = existingChildren.some(
        (ec) => ec.Name === child.Name && ec.DoB === child.DoB
      );
      if (isDuplicate) {
        nOfSkip += 1;
        skipList.push({ Email: family.Email, Name: child.Name, DoB: child.DoB });
        continue;
      }
      const existingCount = existingChildren.length + (addedAny ? 1 : 0);
      await model.child.create({
        ...child,
        FK_Family: savedFamily.id,
        IdWithinFamily: ALPHABET[existingCount] || null,
      });
      addedAny = true;
    }

    nOfAdded += 1;
  }

  return { nOfAdded, nOfSkip, skipList, doubleCheckList };
}

module.exports = {
  childInclude,
  appointmentInclude,
  scheduleInclude,
  batchImportFamilies,
  importIntakeForms,
};
