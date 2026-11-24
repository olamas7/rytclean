const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const { db } = require("../../db");
const fs = require("fs");
const multer = require("multer");

router.use(cors());
router.use(express.json({ limit: "10mb" })); // Increase JSON payload limit to handle large image data
router.use(bodyParser.urlencoded({ extended: true }));

// Using memory storage to temporarily hold file data in memory
const storage2 = multer.memoryStorage();

const upload = multer({
  storage: storage2,
}).single("image");

// Route to handle file upload
// if upload is defined as: const upload = multer().single('image');

router.post("/passport_picture", upload, (req, res) => {
  // now multer has populated req.body and req.file
  const { pic_folder, pic_name } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: "No file received" });
  }

  const filename = `${pic_name}${path.extname(req.file.originalname)}`;
  const filePath = path.join(
    __dirname,
    `../../images/${pic_folder}/`,
    filename
  );

  require("fs").writeFile(filePath, req.file.buffer, (err) => {
    if (err) {
      console.error("File save error:", err);
      return res.json({ error: "File save failed" });
    }
    return res.json({ code: 1, data: filename });
  });
});

// router.post("/passport_picture", (req, res) => {
//   const { index_number } = req.body;
//   console.log(req.body);

//   upload(req, res, function (err) {
//     if (err) {
//       return res.status(500).json({ error: "File upload failed" });
//     }

//     // Generate file name based on stId and original file extension
//     const filename = `${index_number}${path.extname(req.file.originalname)}`;

//     // Define path where the file should be saved
//     const filePath = path.join(__dirname, "../images/categories/", filename);

//     // Write the file to the destination
//     require("fs").writeFile(filePath, req.file.buffer, (err) => {
//       if (err) {
//         console.error("File save error:", err);
//         return res.json({ error: "File save failed" });
//       }
//       return res.json({ code: 1, data: filename });
//     });
//   });
// });

module.exports = router;
