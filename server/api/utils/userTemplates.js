/**
 * User Email Templates
 *
 * Shared email body builders for user account actions.
 * Used by user.js, labService.js, and the email test console.
 */

const config = require("../../config/general");

const MANUAL_LINK =
  "<a href='https://docs.google.com/document/d/1M7K8Td2jI1SIGhd_EWT94zkG6VdZk-clgRwBFZY-d2w/edit?usp=sharing'>A brief manual (under development)</a>";
const GOOGLE_SETUP_LINK =
  "How to set up a Google account to activate email and calendar functions. (coming soon)";

/**
 * Welcome email sent when a new user account is created.
 * Used by: user.js signup, user.js signupBatch, labService.js createLab
 */
function buildWelcomeEmail(name, email, role, password) {
  const firstName = name.split(" ")[0];

  return {
    to: name + " <" + email + ">",
    subject: "Your ObCRC (Oberlin Community Research Contact Registry) user account has been created!",
    htmlBody:
      "<p>Hello " + firstName + ",</p> " +
      "<p>Welcome to the ObCRC (Oberlin Community Research Contact Registry) management system!<br>" +
      "Your role is <b>" + role + "</b>, and your temporary password is <b><em>" + password + "</em></b>. " +
      "Please log in with your email and temporary password at <a href=\"" + config.URL + "\">" + config.URL + "</a> to set a new password. " +
      "<em>Note: You may be unable to access this link unless you are using campus Wi-Fi.</em>" +
      config.otherRequirement +
      "<br><b>If your role is PI, please update your lab email template in the Settings page.</b></p> " +
      "<p>" + MANUAL_LINK + "<br>" + GOOGLE_SETUP_LINK + "</p>" +
      "<p> </p>" +
      "<p>Thank you! <br>" +
      "Oberlin Community Research Contact Registry</p>",
  };
}

/**
 * Password changed confirmation email.
 * Used by: user.js changePassword
 */
function buildPasswordChangedEmail(name, email) {
  const firstName = name.split(" ")[0];

  return {
    to: name + " <" + email + ">",
    subject: "Your ObCRC (Oberlin Community Research Contact Registry) login password is updated.",
    htmlBody:
      "<p>Hello " + firstName + ",</p> " +
      "<p>Your login password has recently been changed. <br>" +
      "If you didn't change your password, please contact your lab manager as soon as possible.</p> " +
      "<p> </p>" +
      "<p>Thank you!<br>" +
      "Oberlin Community Research Contact Registry</p>",
  };
}

/**
 * Password reset email with new temporary password.
 * Used by: user.js resetPassword
 */
function buildPasswordResetEmail(name, email, password) {
  const firstName = name.split(" ")[0];

  return {
    to: name + " <" + email + ">",
    subject: "Your password is reset",
    htmlBody:
      "<p>Hello " + firstName + ",</p> " +
      "<p>You login password is reset, and the temporary passwor is: <b>" + password + "</b></p> " +
      "<p>Please login to change your password.<br> " +
      "<p>" + MANUAL_LINK + "<br>" + GOOGLE_SETUP_LINK + "</p>" +
      "<p> </p>" +
      "<p>Thank you! <br>" +
      "Oberlin Community Research Contact Registry</p>",
  };
}

/**
 * Feedback submission email.
 * Used by: feedback.js create
 */
function buildFeedbackEmail(feedbackEmail, page, title, content) {
  const feedbackRecipient =
    (process.env.FEEDBACK_EMAIL_TO || "sparkchildlab@gmail.com").trim() ||
    "sparkchildlab@gmail.com";

  return {
    to: feedbackRecipient,
    cc: feedbackEmail,
    subject: "[DRDB feedback] " + title,
    htmlBody:
      "<p> from " + feedbackEmail + "<p>" +
      "<p> on " + page + " Page<p>" +
      "<p>====================<p>" +
      content,
  };
}

module.exports = {
  buildWelcomeEmail,
  buildPasswordChangedEmail,
  buildPasswordResetEmail,
  buildFeedbackEmail,
};
