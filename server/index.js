import express from "express";
import bodyParser from "body-parser";
//import login from "login.js";
//import signup from "signup.js";

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

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

app.get("/", (req, res) => {
    var activeFilters = '{family: 0, car: 0}';
    var blogSearch = "";
    res.render("list/index.ejs", { activeFilters: activeFilters, blogSearch: blogSearch });
});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
