const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendApprovalEmail = async (recipient, approvalLink, purchaseDetails) => {
  const { username, planName, amount } = purchaseDetails;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: recipient,
    subject: `New Payment Submission for ${username}`,
    html: `
            <h3>New Payment Submission Received</h3>
            <p>A user has submitted a payment and is awaiting your approval.</p>
            <ul>
                <li><strong>Phone Number:</strong> ${username}</li>
                <li><strong>Plan:</strong> ${planName}</li>
                <li><strong>Amount:</strong> GH₵${amount}</li>
            </ul>
            <p>If you have confirmed receipt of the payment, please approve the subscription by clicking the link below:</p>
            <a href="${approvalLink}" style="background-color: #28a745; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; display: inline-block;">Approve Payment</a>
            <br>
            <p>If you have not received payment, please ignore this email.</p>
        `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Approval email sent successfully.");
  } catch (error) {
    console.error("Error sending approval email:", error);
    // We throw the error so the calling function knows something went wrong
    throw new Error("Failed to send approval email.");
  }
};

module.exports = { sendApprovalEmail };
