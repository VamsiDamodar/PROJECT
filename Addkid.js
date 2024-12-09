const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const mysql = require("mysql2");

const app = express();
const port = 5000;

// Middleware for parsing JSON and enabling CORS
app.use(express.json());
app.use(cors({ origin: "http://localhost:3000" })); // Allow requests from React app
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: "./uploads",
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({ storage });

// Ensure the uploads directory exists
const fs = require("fs");
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// MySQL Database setup
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Sql@123", // Replace with your database password
    database: "activity_app",
});

db.connect((err) => {
    if (err) throw err;
    console.log("Database connected!");
});

// API to add a kid
app.post("/api/kids", upload.single("avatar"), (req, res) => {
    const { name } = req.body;
    const avatar = req.file ? req.file.filename : null;

    if (!name || !avatar) {
        return res.status(400).json({ message: "Name and avatar are required" });
    }

    const sql = "INSERT INTO kids (name, avatar) VALUES (?, ?)";
    db.query(sql, [name, avatar], (err, result) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ message: "Failed to add kid" });
        }
        res.json({ message: "Kid added successfully", kidId: result.insertId });
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
