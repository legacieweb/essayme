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

// MongoDB Connection
mongoose.connect("mongodb://localhost:27017/essayme", {
});

// Schemas and Models
const studentSchema = new mongoose.Schema({
  userId: String,
  name: String,
  email: String,
  password: String,
  profileImage: String,
});

const messageSchema = new mongoose.Schema({
  studentId: String,
  sender: String,
  content: String,
  timestamp: { type: Date, default: Date.now },
});

const Student = mongoose.model("Student", studentSchema);
const Message = mongoose.model("Message", messageSchema);


const orderSchema = new mongoose.Schema({
  orderId: String,
  studentId: String,
  email: String,
  subject: String,
  orderType: String,
  description: String,
  deadline: Date,
  pages: Number,
  timestamp: { type: Date, default: Date.now },
});

const Order = mongoose.model("Order", orderSchema);

// Signup API
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await Student.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email is already used." });
    }

    const hashedPassword = await bcrypt.hash(password, 10); // Hash password
    const userId = `STU${Date.now()}`;
    const student = new Student({ userId, name, email, password: hashedPassword });

    await student.save();
    res.status(201).json({ message: "Signup successful", userId });
  } catch (error) {
    console.error("Signup Error:", error.message);
    res.status(500).json({ message: "Signup failed.", error: error.message });
  }
});

// Login API
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const student = await Student.findOne({ email });

    if (!student) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const isPasswordValid = await bcrypt.compare(password, student.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    res.status(200).json({ userId: student.userId });
  } catch (error) {
    console.error("Login Error:", error.message);
    res.status(500).json({ message: "Login failed.", error: error.message });
  }
});

app.get("/get-account/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
      const student = await Student.findOne({ userId });

      if (!student) {
          return res.status(404).json({ message: "Student not found" });
      }

      res.status(200).json({
          userId: student.userId,
          name: student.name,
          email: student.email,
          walletBalance: student.walletBalance || 0,
          profileCompletion: student.profileCompletion || 0,
          profileImage: student.profileImage ? `http://localhost:3002${student.profileImage}` : "http://localhost:3002/default-profile.png",
      });
  } catch (error) {
      res.status(500).json({ message: "Failed to retrieve account", error: error.message });
  }
});


app.post("/update-account", async (req, res) => {
  const { userId, name, email, bio, linkedin, twitter, instagram } = req.body;

  try {
      const student = await Student.findOne({ userId });
      if (!student) return res.status(404).json({ message: "Student not found" });

      student.name = name || student.name;
      student.email = email || student.email;
      student.bio = bio || student.bio;
      student.socials = { linkedin, twitter, instagram };

      await student.save();
      res.status(200).json({ message: "Account updated successfully" });
  } catch (error) {
      res.status(500).json({ message: error.message });
  }
});


// Chat APIs

// Get Students and Messages
app.get("/get-students-and-messages", async (req, res) => {
  try {
    const students = await Student.find();
    const messages = await Message.find();

    const unreadMessages = {};
    messages.forEach((msg) => {
      if (!unreadMessages[msg.studentId]) {
        unreadMessages[msg.studentId] = 0;
      }
      if (!msg.read && msg.sender === "Student") {
        unreadMessages[msg.studentId] += 1;
      }
    });

    const studentData = students
      .filter((student) => messages.some((msg) => msg.studentId === student.userId))
      .map((student) => ({
        id: student.userId,
        name: student.name,
        email: student.email,
        profileImage: student.profileImage
          ? `http://localhost:3002${student.profileImage}`
          : `http://localhost:3002/uploads/default-profile.png`,
      }));

    res.status(200).json({ students: studentData, unreadMessages });
  } catch (error) {
    console.error("Error fetching students and messages:", error.message);
    res.status(500).json({ message: "Failed to fetch data." });
  }
});


// Get Messages for a Student
app.get("/get-messages/:studentId", async (req, res) => {
  const { studentId } = req.params;
  try {
    const messages = await Message.find({ studentId });
    res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error.message);
    res.status(500).json({ message: "Failed to fetch messages." });
  }
});


// Mark Messages as Read
app.post("/mark-messages-read", async (req, res) => {
  const { studentId } = req.body;
  try {
    await Message.updateMany({ studentId, read: false }, { read: true });
    res.json({ message: "Messages marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark messages as read", error: error.message });
  }
});

// Send a Message
app.post("/send-message", async (req, res) => {
  const { studentId, sender, content } = req.body;

  if (!studentId || !sender || !content) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const newMessage = new Message({
      studentId,
      sender,
      content,
      timestamp: new Date(),
    });

    await newMessage.save();
    res.status(201).json({ message: "Message sent successfully." });
  } catch (error) {
    console.error("Error sending message:", error.message);
    res.status(500).json({ message: "Failed to send message." });
  }
});

app.post("/api/check-email", async (req, res) => {
  const { email } = req.body;

  try {
    const student = await Student.findOne({ email });

    if (student) {
      res.status(200).json({ exists: true, name: student.name });
    } else {
      res.status(200).json({ exists: false });
    }
  } catch (error) {
    console.error("Error during email check:", error.message);
    res.status(500).json({ message: "Server error during email validation." });
  }
});

// Handle Order Placement
app.post("/api/submit-order", async (req, res) => {
  const { email, subject, orderType, description, deadline, pages } = req.body;

  try {
    let student = await Student.findOne({ email });

    if (!student) {
      // Create a new student if email is not registered
      const userId = `STU${Date.now()}`;
      student = new Student({
        userId,
        email,
        password: null, // Optional: Handle password during signup separately
      });
      await student.save();
    }

    // Save the order
    const order = new Order({
      orderId: `ORD${Date.now()}`,
      studentId: student.userId,
      email,
      subject,
      orderType,
      description,
      deadline,
      pages,
    });
    await order.save();

    res.status(201).json({
      message: "Order placed successfully!",
      userId: student.userId,
    });
  } catch (error) {
    console.error("Order Submission Error:", error.message);
    res.status(500).json({ message: "Server error while submitting order." });
  }
});

const assignmentSchema = new mongoose.Schema({
  studentId: String, // Reference to the student's user ID
  title: String, // Title of the assignment
  description: String, // Description of the assignment
  status: { type: String, default: "Pending" }, // Status: Pending, In Review, or Completed
  downloadLink: String, // Download link for completed assignments
  timestamp: { type: Date, default: Date.now }, // Creation date
});

const Assignment = mongoose.model("Assignment", assignmentSchema);

app.get('/get-assignments', async (req, res) => {
  try {
    // Fetch orders where the type is "assignment" or relevant criteria
    const assignments = await Order.find({ type: 'assignment' }); 
    res.json(assignments);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ message: 'Failed to fetch assignments.' });
  }
});

// API Endpoint to Fetch Assignments for a Student
app.get("/get-assignments/:studentId", async (req, res) => {
  const { studentId } = req.params;

  try {
    const orders = await Order.find({ studentId });

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: "No assignments found." });
    }

    const assignments = orders.map(order => ({
      title: order.subject,
      description: order.description,
      status: "Pending",
      deadline: order.deadline,
    }));

    res.status(200).json(assignments);
  } catch (error) {
    console.error("Error fetching assignments:", error.message);
    res.status(500).json({ message: "Failed to fetch assignments." });
  }
});

// API to update the status of an assignment
app.put("/update-assignment-status", async (req, res) => {
  const { assignmentId, status } = req.body;

  try {
    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found." });
    }

    assignment.status = status;
    await assignment.save();

    res.status(200).json({ message: "Assignment status updated successfully." });
  } catch (error) {
    console.error("Error updating assignment status:", error.message);
    res.status(500).json({ message: "Failed to update assignment status." });
  }
});

// API to upload files for an assignment
app.post("/upload-assignment", upload.single("file"), async (req, res) => {
  const { assignmentId } = req.body;
  const fileUrl = `/uploads/${req.file.filename}`;

  try {
    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found." });
    }

    assignment.downloadLink = fileUrl;
    assignment.status = "Completed";
    await assignment.save();

    res.status(200).json({ message: "File uploaded successfully.", fileUrl });
  } catch (error) {
    console.error("Error uploading file:", error.message);
    res.status(500).json({ message: "Failed to upload file." });
  }
});
// Handle Subscription
app.post("/subscribe", async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes("@") || !email.includes(".")) {
    return res.status(400).json({ message: "Invalid email address." });
  }

  try {
    // Send Confirmation Email to User
    await transporter.sendMail({
      from: `"Newsletter" <${SMTP_USER}>`,
      to: email,
      subject: "Subscription Successful!",
      text: `Thank you for subscribing to our newsletter, ${email}! You'll receive updates soon.`,
    });

    // Notify Admin
    await transporter.sendMail({
      from: `"Newsletter" <${SMTP_USER}>`,
      to: ADMIN_EMAIL,
      subject: "New Subscriber Alert!",
      text: `A new user has subscribed: ${email}`,
    });

    res.status(200).json({ message: "Subscription successful! Check your inbox." });
  } catch (error) {
    res.status(500).json({ message: "Subscription failed. Please try again." });
  }
});

// Start Server
const PORT = 3002;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
