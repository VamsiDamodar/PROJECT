const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const mysql = require("mysql2");
const { OAuth2Client } = require("google-auth-library");
const fs = require("fs");
const route=express.Router();

const app = express();
const PORT = 5000;

// Middleware
app.use(express.json());
app.use(cors({ origin: "http://localhost:3000" })); // Allow requests from React app
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// MySQL Database setup
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Sql@123",
  database: "activity_app",
});
db.connect((err) => {
  if (err) throw err;
  console.log("Database connected!");
});

// Google OAuth client setup
const client = new OAuth2Client(
  "353519550161-ctatvkrvlcl2tvh30jf38gim48uel2vd.apps.googleusercontent.com"
);

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: "./uploads",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Ensure the uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// API: Login with Google or Facebook
app.post("/api/login", async (req, res) => {
  const { token, provider } = req.body; // Accept provider (Google or Facebook) from the front-end

  try {
    if (provider === "google") {
      // Verify Google token
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: "353519550161-ctatvkrvlcl2tvh30jf38gim48uel2vd.apps.googleusercontent.com", // Use your client ID
      });
      const payload = ticket.getPayload();
      const { email, name } = payload;

      // Check if user exists or register
      db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
          // User exists
          res.json({ message: "User exists", user: results[0] });
        } else {
          // Insert new user
          const sql = "INSERT INTO users (name, email) VALUES (?, ?)";
          db.query(sql, [name, email], (err, result) => {
            if (err) throw err;
            res.json({ message: "User registered successfully", userId: result.insertId });
          });
        }
      });
    } else if (provider === "facebook") {
      // Verify Facebook token
      const fbResponse = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email&access_token=${token}`
      );
      const fbData = await fbResponse.json();

      if (fbData.error) {
        return res.status(400).json({ error: "Invalid Facebook token" });
      }

      const { email, name } = fbData;

      // Check if user exists or register
      db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
          // User exists
          res.json({ message: "User exists", user: results[0] });
        } else {
          // Insert new user
          const sql = "INSERT INTO users (name, email) VALUES (?, ?)";
          db.query(sql, [name, email], (err, result) => {
            if (err) throw err;
            res.json({ message: "User registered successfully", userId: result.insertId });
          });
        }
      });
    } else {
      res.status(400).json({ error: "Invalid provider" });
    }
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
});

// Api to add a kid
app.post("/api/kids", upload.single("avatar"), (req, res) => {
  const { name, gender, password } = req.body; // Extract password
  const avatar = req.file ? req.file.filename : null;

  // Validate required fields
  if (!name || !avatar || !gender || !password) {
      return res.status(400).json({ message: "Name, avatar, gender, and password are required" });
  }

  // Insert kid into database
  const sql = "INSERT INTO kids (name, avatar, gender, password) VALUES (?, ?, ?, ?)";
  db.query(sql, [name, avatar, gender, password], (err, result) => {
      if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ message: "Failed to add kid" });
      }

      res.json({ message: "Kid added successfully", kidId: result.insertId });
  });
});

// GET route to fetch all kids
app.get("/api/kids", (req, res) => {
  const sql = "SELECT * FROM kids ";
  
  db.query(sql, (err, results) => {
      if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ message: "Error fetching kids from the database" });
      }

      if (results.length === 0) {
          return res.status(404).json({ message: "No kids available" });
      }

      // Send the list of kids to the client
      res.json({ kids: results });
  });
});




app.use("/uploads", express.static("uploads"));
// Start server

// Fetch all activities
app.get("/api/activities", (req, res) => {
    const sql = "SELECT * FROM activities";
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching activities:", err);
            return res.status(500).json({ message: "Error fetching activities" });
        }
        res.json(results);
    });
});



// Create new activity
app.post("/api/activities", (req, res) => {
  const { name, description, points, frequency, days, start_time, end_time, color_code } = req.body;

  if (!name || !points || !frequency || !start_time || !end_time) {
      return res.status(400).json({ message: "Required fields are missing" });
  }

  const sql = `
      INSERT INTO activities (name, description, points, frequency, days, start_time, end_time, color_code, toggle)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `;
  db.query(sql, [name, description, points, frequency, days, start_time, end_time, color_code], (err, result) => {
      if (err) {
          console.error("Error inserting activity:", err);
          return res.status(500).json({ message: "Error inserting activity" });
      }
      res.json({ message: "Activity created successfully" });
  });
});

// Toggle activity state
app.put("/api/activities/:id/toggle", (req, res) => {
  const { id } = req.params;

  // Check if the activity exists and get its current toggle state
  const getToggleSql = `SELECT toggle FROM activities WHERE id = ?`;
  db.query(getToggleSql, [id], (err, result) => {
      if (err) {
          console.error("Error fetching activity:", err);
          return res.status(500).json({ message: "Error fetching activity" });
      }

      if (result.length === 0) {
          return res.status(404).json({ message: "Activity not found" });
      }

      const currentToggleState = result[0].toggle;
      const newToggleState = currentToggleState ? 0 : 1; // Toggle the state

      // Update the toggle state in the database
      const updateToggleSql = `UPDATE activities SET toggle = ? WHERE id = ?`;
      db.query(updateToggleSql, [newToggleState, id], (updateErr) => {
          if (updateErr) {
              console.error("Error updating toggle state:", updateErr);
              return res.status(500).json({ message: "Error updating toggle state" });
          }

          res.json({ message: "Activity toggle updated successfully", toggle: newToggleState });
      });
  });
});

// Toggle the activity and update kid's points
app.put("/api/activities/:id/toggle", async (req, res) => {
  const { id } = req.params; // Activity ID from URL
  const { toggle, kidId } = req.body; // Toggle and Kid ID from body

  if (!kidId || typeof toggle === "undefined") {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    // Fetch the activity by ID
    const activity = await Activity.findById(id);
    if (!activity) {
      return res.status(404).json({ error: "Activity not found" });
    }

    // Update the toggle state of the activity
    activity.toggle = toggle;
    await activity.save();

    // Fetch the kid by ID
    const kid = await Kid.findById(kidId);
    if (!kid) {
      return res.status(404).json({ error: "Kid not found" });
    }

    // Update the kid's points based on the toggle state
    if (toggle) {
      kid.points += activity.points; // Add points if activity is enabled
    } else {
      kid.points -= activity.points; // Deduct points if activity is disabled
    }

    // Ensure points do not fall below 0
    kid.points = Math.max(kid.points, 0);

    await kid.save();

    res.status(200).json({
      message: "Activity toggled successfully and kid's points updated",
      activity,
      kid,
    });
  } catch (error) {
    console.error("Error toggling activity:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});



// Routes
// Get all rewards
app.get("/api/rewards", (req, res) => {
  db.query("SELECT * FROM rewards", (err, results) => {
      if (err) {
          console.error("Error fetching rewards:", err);
          res.status(500).send("Error fetching rewards");
      } else {
          res.json(results);
      }
  });
});

// Add a new reward
app.post("/api/rewards", (req, res) => {
  const { min, max, reward } = req.body;

  if (!min || !max || !reward) {
      return res.status(400).send("All fields are required");
  }

  const query = "INSERT INTO rewards (min_points, max_points, reward) VALUES (?, ?, ?)";
  db.query(query, [min, max, reward], (err, result) => {
      if (err) {
          console.error("Error adding reward:", err);
          res.status(500).send("Error adding reward");
      } else {
          res.status(201).json({ id: result.insertId, min, max, reward });
      }
  });
});

// Update a reward
app.put("/api/rewards/:id", (req, res) => {
  const { id } = req.params;
  const { min, max, reward } = req.body;

  const query = "UPDATE rewards SET min_points = ?, max_points = ?, reward = ? WHERE id = ?";
  db.query(query, [min, max, reward, id], (err, result) => {
      if (err) {
          console.error("Error updating reward:", err);
          res.status(500).send("Error updating reward");
      } else {
          res.json({ message: "Reward updated successfully" });
      }
  });
});

// GET /api/activities route
app.get('/api/activities', (req, res) => {
  const query = 'SELECT * FROM activities';
  db.query(query, (err, results) => {
      if (err) {
          console.error('Error fetching activities:', err);
          res.status(500).json({ error: 'Database query failed' });
          return;
      }
      res.json(results);
  });
});

// Get all activities
app.get("/api/activities", (req, res) => {
  db.query("SELECT * FROM activities", (err, results) => {
    if (err) {
      console.error("Error fetching activities:", err.message);
      res.status(500).json({ error: "Internal Server Error" });
    } else {
      res.json(results);
    }
  });
});

// Get daily points summary for a user
app.get("/api/points-summary", (req, res) => {
  const userId = req.query.userId; // User ID from query parameters
  const query = `
    SELECT date, SUM(points_earned) AS total_points
    FROM activity_points
    WHERE user_id = ?
    GROUP BY date
    ORDER BY date;
  `;
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Error fetching points summary:", err.message);
      res.status(500).json({ error: "Internal Server Error" });
    } else {
      res.json(results);
    }
  });
});

// Add points for an activity
app.post("/api/add-points", (req, res) => {
  const { activity_id, user_id, date, points_earned } = req.body;
  const query = `
    INSERT INTO activity_points (activity_id, user_id, date, points_earned)
    VALUES (?, ?, ?, ?);
  `;
  db.query(query, [activity_id, user_id, date, points_earned], (err, results) => {
    if (err) {
      console.error("Error adding points:", err.message);
      res.status(500).json({ error: "Internal Server Error" });
    } else {
      res.json({ success: true, message: "Points added successfully!" });
    }
  });
});



// Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));