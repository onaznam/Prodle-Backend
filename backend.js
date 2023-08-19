const express = require("express");
const app = express();
const router = express.Router();
const mongoose = require("mongoose");
require("dotenv").config();
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
app.use(express.json());
app.use(cookieParser());


const PORT = process.env.PORT || 3000;


app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://prodle.net");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH"
  );
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true"); //for tokens

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
});

mongoose
  .connect(
    `mongodb+srv://${process.env.USER}:${process.env.PASSWORD}@fitnessapp.uvbptei.mongodb.net/prodle`,
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => console.log("Database connected!"))
  .catch((err) => console.log(err));

  //token needs to access something
  // function authenticateToken(req, res, next) {
  //   const token = req.cookies.jwt;
  //   if (token == null) return res.sendStatus(401); // if there isn't any token
  
  //   jwt.verify(token, process.env.SECRET, (err, user) => {
  //     if (err) return res.sendStatus(403);
  //     req.user = user;
  //     next(); // pass the execution off to whatever request the client intended
  //   });
  // }

  function authenticateToken(req, res, next) {
    const token = req.cookies.jwt;
    console.log('Token from cookie:', token); // Log the token
    if (token == null) return res.sendStatus(401); // if there isn't any token

    jwt.verify(token, process.env.SECRET, (err, user) => {
        console.log('Decoded user:', user); // Log the decoded user
        if (err) return res.sendStatus(403);
        req.user = user;
        next(); // pass the execution off to whatever request the client intended
    });
}


const Schema = mongoose.Schema;
const WordSchema = new Schema({
  //should be word: String
  iambic: String,
});

const Words = mongoose.model("Words", WordSchema, "words");

//gets 17.3k words
app.get("/api/words", async (req, res) => {
  try {
    // Fetch all words from MongoDB
    const words = await Words.find();

    // Send them to the client
    res.status(200).json(words);
  } catch (err) {
    // Handle error
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

const UserSchema = new Schema({
  username: String,
  password: String,
  wins: Number,
  losses: Number,
  streak: Number
});

const Users = mongoose.model("Users", UserSchema, "users");


//register
app.post("/register", async (req, res) =>{
  const userExists = await Users.findOne({username: req.body.username});
  if(userExists){
    return res.status(400).send("User already exists");
  }
  try{
    const hashPW = await bcrypt.hash(req.body.password, 10);
    const user = new Users({
      username: req.body.username,
      password: hashPW,
      wins: 0,
      losses: 0,
      streak: 0
    });
    const newUser = await user.save();
    res.json(newUser);
  }
  catch(err){
    res.status(500).json({error: err.message});
  }
});

//login
app.post("/login", async (req, res) => {
  console.log("Login hit");
  const username = req.body.username;
  const user = await Users.findOne({ username: username });
  console.log("user: ", user);
  if (user === null) {
      return res.status(400).send("Cannot find user");
  }
  
  try {
      if (await bcrypt.compare(req.body.password, user.password)) {
          const accessToken = jwt.sign(
              { username: user.username }, 
              process.env.SECRET, 
              { expiresIn: "1hr" }
          );
          res.cookie("jwt", accessToken, { httpOnly: false, secure: true });
          res.status(200).json({ success: true });
      } else {
          res.status(400).send("Invalid password");
      }
  } catch (error) {
      console.error(error);
      res.status(500).send();
  }
});

//logout
app.post("/logout", (req, res) => {
  try {
    res.clearCookie("jwt", { httpOnly: false, secure: true });
    res.status(200).send("User logged out");
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//return user object
app.get("/getUser/:username", authenticateToken, async (req, res) => {
  try {
    const user = await Users.findOne({ username: req.params.username });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.send(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//update wins or loss
app.patch("/updateResults", authenticateToken, async(req, res) =>{
  try{
    const user = await Users.findOne({username: req.user.username});
    if (!user){
      return res.status(404).json({error: "User not found"});
    }
    console.log(req.body.username, req.body.value);
    
    if(req.body.value === "win"){
      user.wins += 1;
      user.streak += 1;
    }  
    else if(req.body.value === "loss"){
      user.losses += 1;
      user.streak = 0;
    }
    const updateUser = await user.save();
    res.json(updateUser);
  }
  catch(err){
    res.status(500).json({error: err.message});
  }
});

//authenticate user
router.get("/user", authenticateToken, (req, res) => {
  console.log("attempting to authenticate user");
  // If the user is authenticated, return their data.
  if (req.user) {
    res.json(req.user);
  } else {
    // If the user is not authenticated, return an error message.
    res.status(401).json({ error: "Not authenticated" });
  }
});
app.use("/api", router);

module.exports = router;

app.get("/" , (req,res) => {
  res.send("Hello 2");
})

app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});
module.exports = app;

