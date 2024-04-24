import express from "express";
import bodyParser from "body-parser";
import fs from "fs/promises";
import path from "path"; 

//import login from "login.js";
//import signup from "signup.js";

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

async function blogs() {
    const directoryPath = path.join(new URL('.', import.meta.url).pathname, '..', 'db', 'blogs');
    try {
        const files = await fs.readdir(directoryPath);
        const blogDataPromises = files.map(async fileName => {
            try {
                const file = await fs.readFile(path.join(directoryPath, fileName), 'utf8');
                if (!file) {
                    throw new Error(`File '${fileName}' is empty or could not be read.`);
                }
                const fileLines = file.split('\n');

                const content = fileLines.slice(4).join('\n'); // Join lines starting from index 4
                
                const postedStr = () => {
                    const postedDate = new Date(fileLines[3]); // Assuming the date is stored as a string
                    const currentDate = new Date();
                    const timeDifference = currentDate.getTime() - postedDate.getTime();
                    const daysAgo = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
                
                    if (daysAgo === 1) {
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
                console.error('Error reading file:', error);
                return null;
            }
        });
        return Promise.all(blogDataPromises);
    } catch (error) {
        console.error('Error reading directory:', error);
        return [];
    }
};

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

app.get("/:data", (req, res) => {
    const data = JSON.parse(req.params.data);

    const activeFilters = data.filters;
    const blogSearch = data.search;

    res.render("list/index.ejs", { activeFilters: activeFilters, blogSearch: blogSearch, async: true});
});

app.get("/", async (req, res) => {
    const activeFilters = {};
    const blogSearch = "";

    try {
        const blogData = await blogs();
        res.render("list/index.ejs", { blogs: blogData, activeFilters: activeFilters, blogSearch: blogSearch, async: true});
    } catch (error) {
        console.error('Error rendering view:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
