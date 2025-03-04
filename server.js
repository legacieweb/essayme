require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");


const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // Serve profile images

// 🔹 Configure Nodemailer (Using Gmail as sender)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER, // Your Gmail
    pass: process.env.GMAIL_PASS, // Gmail App Password
  },
});


// Multer Setup for Profile Image Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// 🔹 Handle newsletter subscription
app.post("/subscribe", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    // ✅ Confirmation Email to User
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: "Thank You for Subscribing to EssayMe!",
      html: `<h3>Welcome to EssayMe!</h3>
             <p>Thank you for subscribing to our newsletter. Stay tuned for updates and discounts!</p>
             <br>
             <p>Best Regards,</p>
             <p><strong>EssayMe Team</strong></p>`,
    });

    // ✅ Notify Admin about the New Subscriber
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.ADMIN_EMAIL, // Admin email (optional)
      subject: "New Newsletter Subscriber",
      text: `New subscriber: ${email}`,
    });

    res.status(200).json({ message: "Subscription successful!" });
  } catch (error) {
    console.error("Email error:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
});

// ✅ Handle Full Order Submission (Single Order Type)
app.post("/submit-form", upload.array("files", 10), async (req, res) => {
  try {
    const { subject, orderType, description, deadline, pages, phone, email } = req.body;
    const files = req.files;


    let emailSubject = `${email} has submitted an assignment`;

    let htmlContent = `
      <div style="max-width: 600px; font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
        <h2 style="text-align: center; color: #333;">📩 Assignment Submission</h2>

        <div style="border-top: 2px solid #444; margin: 10px 0;"></div>

        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone Number:</strong> ${phone || "Not provided"}</p>

        <div style="border-top: 2px solid #444; margin: 10px 0;"></div>

        <h3 style="color: #333;">📌 Assignment Details</h3>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Order Type:</strong> ${orderType}</p>
        <p><strong>Deadline:</strong> ${deadline}</p>
        <p><strong>Pages:</strong> ${pages}</p>

        <div style="border-top: 2px solid #444; margin: 10px 0;"></div>

        <h3 style="color: #333;">📑 Assignment Description</h3>
        <p style="background: #f9f9f9; padding: 10px; border-radius: 5px; border-left: 4px solid #4A90E2;">${description}</p>

        <div style="border-top: 2px solid #444; margin: 10px 0;"></div>

        <h3 style="color: #333;">📎 Attachments</h3>
        <p>${files.length > 0 ? "Attached Files" : "No files uploaded"}</p>
      </div>
    `;

    let mailOptions = {
      from: `"Student Submission" <${process.env.GMAIL_USER}>`,
      replyTo: email,
      to: process.env.RECIPIENT_EMAIL,
      subject: emailSubject,
      html: htmlContent,
      attachments: files.map((file) => ({
        filename: file.originalname,
        path: file.path,
      })),
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "Email sent successfully!" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ success: false, message: "Failed to send email" });
  }
});



// Start Server
const PORT = 3002;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
