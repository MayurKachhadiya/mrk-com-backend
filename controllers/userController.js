const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = "1h";

const userSignUp = async (req, res) => {
  const { name, email, password, userType = "user" } = req.body;
  const profileImage = req.file ? req.file.filename : null;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      userImage: profileImage,
      password: hashedPassword,
      userType,
    });
    const savedUser = await newUser.save();

    const token = jwt.sign(
      {
        id: savedUser.id,
        name: savedUser.name,
        userImage: savedUser.userImage,
        email: savedUser.email,
        userType: savedUser.userType,
      },
      JWT_SECRET,
      { expiresIn: TOKEN_TTL }
    );
    res.status(201).json({ message: "Successfully SignUp", token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const userSignIn = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        title: "Error",
        message: "Email & password required",
      });
    }

    const userExists = await User.findOne({ email });
    if (!userExists) {
      return res.status(401).json({
        title: "Error",
        message: "Invalid credentials",
      });
    }

    const passValid = await bcrypt.compare(password, userExists.password);
    if (!passValid) {
      return res.status(401).json({
        title: "Error",
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      {
        id: userExists.id,
        name: userExists.name,
        email: userExists.email,
        userImage: userExists.userImage
        userType: userExists.userType,
      },
      JWT_SECRET,
      { expiresIn: TOKEN_TTL }
    );

    return res.json({
      title: "Success",
      message: "Successfully logged in",
      token,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

const userUpdate = async (req, res) => {
  try {
    const { uid } = req.params;
    const userImage = req.file ? req.file.filename : null;

    const { userName, userEmail, userPassword } = req.body;
    if (!userName || !userEmail) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const findUser = await User.findOne({ _id: uid });
    findUser.name = userName;
    findUser.email = userEmail;
    if (userPassword) {
      const hashedPassword = await bcrypt.hash(userPassword, 10);

      findUser.password = hashedPassword;
    }
    if (userImage) {
      findUser.userImage = userImage;
    }
    await findUser.save();

    const token = jwt.sign(
      {
        id: findUser.id,
        name: findUser.name,
        email: findUser.email,
        userImage: findUser.userImage,
        userType: findUser.userType,
      },
      JWT_SECRET,
      { expiresIn: TOKEN_TTL }
    );
    res
      .status(200)
      .json({ message: "User Details updated successfully", token });
  } catch (err) {
    return res.status(500).json({ message: "server error" });
  }
};

module.exports = {
  userSignUp,
  userSignIn,
  userUpdate,
};
