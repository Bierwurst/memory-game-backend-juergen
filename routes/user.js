const express = require("express");
const bcrypt = require("bcryptjs");
var jwt = require("jsonwebtoken");
var multer = require("multer");
const uuidv1 = require("uuid/v1");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const User = require("../models/User");
const keys = require("../config/keys");
const { validationResult } = require("express-validator/check");
const validation = require("../validation/userValidation");

router.post("/signup", validation.signup, async (req, res) => {
  const { username, email, password } = req.body;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ error: errors.array() });
  }
  const hashedPassword = await bcrypt.hash(password, 12);
  if (hashedPassword) {
    return new User({
      username,
      email,
      password: hashedPassword
    }).save((err, userdata) => {
      if (err) {
        return res.status(422).json({ error: err });
      }

      const expirationDate = 2592000000;
      const token = jwt.sign(
        {
          username: userdata.username,
          email: userdata.email,
          id: userdata._id.toString(),
          admin: userdata.admin,
          avatar: userdata.avatar
        },
        keys.jwtKey,
        { expiresIn: expirationDate }
      );

      return res.status(201).json(token);
    });
  }
});

router.post("/login", validation.login, async (req, res, next) => {
  const { email } = req.body;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ error: errors.array() });
  }
  try {
    const user = await User.findOne({ email });
    if (user) {
      const expirationDate = 2592000000;
      const token = jwt.sign(
        {
          username: user.username,
          email: user.email,
          id: user._id.toString(),
          admin: user.admin,
          avatar: user.avatar
        },
        keys.jwtKey,
        { expiresIn: expirationDate }
      );
      return res
        .status(200)
        .json({ token, userId: user._id.toString(), expirationDate });
    }
  } catch (e) {
    const error = new Error(e);
    error.httpStateCode = 500;
    return next(error);
  }
});
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads/avatars");
  },
  filename: (req, file, cb) => {
    cb(null, uuidv1() + "-" + file.originalname);
  }
});
const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpeg"
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};
const upload = multer({
  storage,
  fileFilter
});

router.post("/avatar/:id", upload.single("avatar"), (req, res) => {
  User.findById(req.params.id).then(user => {
    if (!user) {
      res.json({ msg: "the user is not exsist" });
    }
    if (user.ava) {
      let oldFilePath = user.avatar.split("/");
      console.log(oldFilePath);
      const filePathInFs = path.join(
        oldFilePath[3],
        oldFilePath[4],
        oldFilePath[5]
      );
      fs.unlink(filePathInFs, err => {
        if (err) throw err;
        user.avatar =
          "https://memory-game-7.herokuapp.com/uploads/avatars/" +
          req.file.filename;
        user.save((err, userdata) => {
          if (err) {
            return res.status(422).json({ error: err });
          }

          return res.status(201).json(userdata);
        });
      });
    } else {
      user.avatar =
        "https://memory-game-7.herokuapp.com/uploads/avatars/" +
        req.file.filename;
      user.ava = true;
      user.save();
      return res.json(user);
      console.log(req.file);
    }
  });
});

module.exports = router;
