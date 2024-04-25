import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import fs from "fs/promises";
import path from "path"; 
import { File } from "buffer";
import bcrypt from "bcrypt";

//import login from "login.js";
//import signup from "signup.js";

const app = express();
const port = 3000;
const __dirname = new URL(".", import.meta.url).pathname;

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true
}));



async function blogs() {
    try {
        const directoryPath = path.join(__dirname, "..", "db", "blogs");
        const files = await fs.readdir(directoryPath);
        const blogDataPromises = files.map(async fileName => {
            try {
                const file = await fs.readFile(path.join(directoryPath, fileName), "utf8");
                if (!file) {
                    throw new Error(`File "${fileName}" is empty or could not be read.`);
                }
                const fileLines = file.split("\n");

                const content = fileLines.slice(4).join("\n"); // Join lines starting from index 4
                
                const postedStr = () => {
                    const postedTimestamp = parseInt(fileLines[2]); // Parse the timestamp string to an integer
                    const postedDate = new Date(postedTimestamp); // Create a Date object from the timestamp
                    if (isNaN(postedDate.getTime())) {
                        return "Error";
                    }
                    const currentDate = new Date();
                    const timeDifference = currentDate.getTime() - postedDate.getTime();
                    const daysAgo = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
                
                    if (daysAgo < 1) {
                        return "recently";
                    } else if (daysAgo === 1) {
                        return "yesterday";
                    } else if (daysAgo <= 7) {
                        return `${daysAgo} days ago`;
                    } else if (daysAgo <= 30) {
                        return `${Math.floor(daysAgo / 7)} weeks ago`;
                    } else if (daysAgo <= 364) {
                        return `${Math.floor(daysAgo / 30)} months ago`;
                    } else {
                        return `${Math.floor(daysAgo / 365)} years ago`;
                    }
                }

                const fileData = {
                    id: fileName.split(".")[0],
                    title: fileLines[0],
                    author: fileLines[1],
                    posted: postedStr(),
                    tags: fileLines[3].split(" "),
                    content: content
                }

                return fileData;
            } catch (error) {
                console.error("Error reading file:", error);
                return null;
            }
        });
        return Promise.all(blogDataPromises);
    } catch (error) {
        console.error("Error reading directory:", error);
        return [];
    }
};

app.get("/bloglist", (req, res) => {

});

app.get("/blog/:data", (req, res) => {

});

app.get("/home", (req, res) => {
    if (req.session.isLoggedIn) {
        res.render("home/main.ejs");
    } else {
        res.redirect("/login");
    }
});

app.get("/login", (req, res) => {
    res.render("login/index.ejs");
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const directoryPath = path.join(__dirname, "..", "db", "accounts");
    const filePath = path.join(directoryPath, `${username}.json`);

    try {
        const userData = await fs.readFile(filePath, "utf8");
        const data = JSON.parse(userData);

        bcrypt.compare(password, data.password, (err, result) => {
            if (result) {
                req.session.isLoggedIn = true;
                res.redirect("/home");
            } else {
                res.render("login/index.ejs", {message: "Invalid username or password"});
            }
        });
    } catch (error) {
        console.log(error)
        res.render("login/index.ejs", {message: "Invalid username or password"});
    }
});

app.get("/signup", (req, res) => {
    res.render("signup/index.ejs");
});

app.post("/signup", async (req, res) => {
    const { username, password } = req.body;
    const directoryPath = path.join(__dirname, "..", "db", "accounts");
    const filePath = path.join(directoryPath, `${username}.json`);

    try {
        const fileExists = await fs.access(filePath).then(() => true).catch(() => false);

        if (!fileExists) {
            bcrypt.genSalt(10, (err, salt) => {
                if (err) {
                    console.error("Error generating salt:", err);
                    res.render("signup/index.ejs", {message: "Internal Server Error"});
                    return;
                }
                
                bcrypt.hash(password, salt, async (err, hash) => {
                    if (err) {
                        console.error("Error hashing password:", err);
                        res.render("signup/index.ejs", {message: "Internal Server Error"});
                        return;
                    }

                    const userDataObj = {
                        password: hash,
                        ownedBlogs: []
                    };

                    try {
                        // Write the user data to the file
                        await fs.writeFile(filePath, JSON.stringify(userDataObj), "utf8");
                        req.session.isLoggedIn = true;
                        res.redirect("/home");
                    } catch (error) {
                        console.error("Error writing user data to file:", error);
                        res.render("signup/index.ejs", {message: "Internal Server Error"});
                    }
                });
            });
        } else {
            res.render("signup/index.ejs", {message: "Username already exists!"});
        }
    } catch (error) {
        console.error("Error reading user data file:", error);
        res.render("signup/index.ejs", {message: "Internal Server Error"});
    }
});

app.get("/:data", (req, res) => {
    const data = JSON.parse(req.params.data);

    const activeFilters = data.filters;
    const blogSearch = data.search;

    res.render("list/index.ejs", { activeFilters: activeFilters, blogSearch: blogSearch});
});

app.get("/", async (req, res) => {
    const activeFilters = {};
    const blogSearch = "";
    try {
        const blogData = await blogs();
        res.render("list/index.ejs", { blogs: blogData, activeFilters: activeFilters, blogSearch: blogSearch});
    } catch (error) {
        console.error("Error rendering view:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
