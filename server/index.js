import express from "express";
import bodyParser from "body-parser";
//import login from "login.js";
//import signup from "signup.js";
//yo
const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    res.render("index.ejs");
});

app.get("/bloglist", (req, res) => {

});

app.get("/blog/:data", (req, res) => {

});

app.get("/home", (req, res) => {

});

app.get("/login", (req, res) => {

});

app.post("/login", (req, res) => {

});

app.get("/signup", (req, res) => {

});

app.post("/signup", (req, res) => {

});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
