const model = require("../models/DRDB");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs");
const { sendAdminEmail } = require("../utils/emailUtil");
const { buildWelcomeEmail } = require("../utils/userTemplates");

/**
 * Create a new lab with associated personnel, a sample study,
 * a welcome email, and filesystem setup.
 *
 * @param {Object} labData - Lab creation payload (from the request body)
 * @returns {Object} The created lab record (with Personnels)
 */
exports.createLab = async (labData) => {
  let step = "initialize";
  let lab;

  try {
    // 1. Set default field values
    step = "set-default-lab-fields";
    labData.EmailOpening = "<p>Email opening (currently not in use).<p>";
    labData.EmailClosing =
      "<p>Please feel free to let us know if you wish to change the time for your study. You can either send us an email.<p>";
    labData.TYEmail =
      "<p>Please, if you have a chance, consider spreading the word to other families you may know who might like to participate.<p>";
    labData.Location =
      "Psychology Building, McMaster University (used in calendar events)";
    labData.TransportationInstructions =
      "<p>Our lab is located at Psychology Building, McMaster University. There are 3 parking lots in front of the building that you can park when you come. We will wait for you at the parking lot.<p>";

    // 2. Generate secure passwords (crypto.randomBytes instead of Math.random)
    step = "prepare-personnel-passwords";
    labData.Personnels.forEach((personnel) => {
      const rawPassword = crypto.randomBytes(8).toString("hex");
      personnel.unencryptedPassword = rawPassword;
      personnel.Password = bcrypt.hashSync(rawPassword, 10);
      personnel.temporaryPassword = true;
    });

    // 3. Create lab + personnel in the database
    step = "create-lab-with-personnel";
    lab = await model.lab.create(labData, {
      include: [model.personnel],
    });

    // 4. Create a sample study with an age group entry
    step = "create-sample-study";
    const sampleStudy = await model.study.create({
      StudyName: "Sample study for " + lab.LabName,
      PhoneScript: "hello there",
      Description:
        "Study description should be a short summary of a study. So RAs can read it to parents during recruitment.",
      EmailTemplate:
        "<p><strong>${{participantName}}</strong> will watch a short clip of videos on a screen in front of ${{him/her}}. To understand neural development, ${{participantName}} may wear a recording cap while watching the videos. We will use a camera to monitor ${{his/her}} attention status, which helps us determine the quality of recorded neural signals. The study will last about 10 minutes.</p>",
      ReminderTemplate:
        "<p>This is a reminder that <strong>${{participantName}}</strong> is scheduled for an upcoming study with our lab.</p><p>If this is an online study, please use this link: ${{ZoomLink}}</p>",
      FollowUPEmailSnippet: "<p>Thank you for participating with ${{participantName}} today. We appreciate your time and support.</p>",
      Completed: false,
      StudyType: "Behavioural",
      ASDParticipant: "Include",
      PrematureParticipant: "Include",
      HearingLossParticipant: "Include",
      VisionLossParticipant: "Include",
      IllParticipant: "Include",
      FK_Personnel: lab.Personnels[0].id,
      FK_Lab: lab.id,
      FK_TestingRoom: null,
    });

    step = "create-default-study-age-group";
    await model.studyAgeGroup.create({
      FK_Study: sampleStudy.id,
      MinAge: 8,
      MaxAge: 24,
    });

    // 5. Send welcome email to the first personnel (lab admin)
    step = "send-welcome-email";
    const admin = labData.Personnels[0];
    const welcomeEmail = buildWelcomeEmail(
      admin.Name,
      admin.Email,
      admin.Role,
      admin.unencryptedPassword
    );
    await sendAdminEmail(welcomeEmail);

    // 6. Create lab filesystem directory
    step = "create-lab-folder";
    const labFolderPath = "api/google/labs/lab" + lab.id;
    if (!fs.existsSync("api/google/labs")) {
      fs.mkdirSync("api/google/labs");
    }
    if (!fs.existsSync(labFolderPath)) {
      fs.mkdirSync(labFolderPath);
    }

    return lab;
  } catch (error) {
    console.error("[createLab] failed", {
      step,
      labName: labData?.LabName,
      personnelCount: Array.isArray(labData?.Personnels) ? labData.Personnels.length : 0,
      createdLabId: lab?.id || null,
      errorName: error?.name,
      errorMessage: error?.message,
      sequelizeErrors: error?.errors?.map((e) => ({
        message: e.message,
        type: e.type,
        path: e.path,
      })) || null,
      parentCode: error?.parent?.code || null,
      parentErrno: error?.parent?.errno || null,
    });
    throw error;
  }
};
