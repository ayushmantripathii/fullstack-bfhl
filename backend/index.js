const express = require("express");
const cors = require("cors");
const { processData } = require("./logic.js");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("API Running");
});

app.get("/bfhl", (req, res) => {
  res.json({ message: "Use POST method to access this endpoint" });
});

app.post("/bfhl", (req, res) => {
  try {
    const { data } = req.body;
    const result = processData(data);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port 3000");
});
