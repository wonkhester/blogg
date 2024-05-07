import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import fs from "fs/promises";
import path from "path"; 
import { File } from "buffer";
import bcrypt from "bcrypt";
import { type } from "os";

const app = express();
const port = 3000;
const __dirname = path.resolve();
const dataBasePath = path.join(__dirname, "..", "db");
const blogPath = path.join(dataBasePath, "blogs");
const accountsPath = path.join(dataBasePath, "accounts");

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: "89320+45yewpiufhgp49187yepifgb4o1ugwepfiug40pqubprfiug40pqöu4bögv",
    resave: false,
    saveUninitialized: true
}));

export async function blogs() {
    try {
        const files = await fs.readdir(blogPath);
        const blogDataPromises = files.map(async fileName => {
            try {
                const fileData = JSON.parse(await fs.readFile(path.join(blogPath, fileName), "utf8"));
                if (!fileData) {
                    throw new Error(`File "${fileName}" is empty or could not be read.`);
                }

                const data = {
                    id: fileName.split(".")[0],
                    title: fileData.title,
                    author: fileData.author,
                    posted: fileData.posted,
                    tags: fileData.tags,
                    preview: fileData.preview,
                }

                return data;
            } catch (error) {
                console.error("Error reading file:", error);
                return null;
            }
        });
        
        const blogData = await Promise.all(blogDataPromises);
        return blogData.filter(data => data !== null);
    } catch (error) {
        console.error("Error reading directory:", error);
        return [];
    }
};

export async function userBlogs(ownedBlogs) {
    try {
        const files = ownedBlogs.map(blogId => {
            return blogId + ".json";
        });
        const blogDataPromises = files.map(async fileName => {
            try {
                const fileData = JSON.parse(await fs.readFile(path.join(blogPath, fileName), "utf8"));
                if (!fileData) {
                    throw new Error(`File "${fileName}" is empty or could not be read.`);
                }

                const data = {
                    id: fileName.split(".")[0],
                    title: fileData.title,
                    author: fileData.author,
                    posted: fileData.posted,
                    tags: fileData.tags,
                    preview: fileData.preview,
                    owner: true,
                }

                return data;
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
}

app.get("/blog/edit/:id", async (req, res) => {
    const id = req.params.id;
    try {
        if (req.session && req.session.isLoggedIn) {
            const username = req.session.username;

            const userFilePath = path.join(accountsPath, `${username}.json`);
            const userData = JSON.parse(await fs.readFile(userFilePath, "utf8"));
            
            if (userData.ownedBlogs.includes(parseInt(id))) {
                const blogData = JSON.parse(await fs.readFile(path.join(blogPath, id + ".json"), "utf8"));
                if (!blogData) {
                    throw new Error(`File "${id}.json" is empty or could not be read.`);
                }

                const data = {
                    id: id,
                    title: blogData.title,
                    tags: blogData.tags,
                    preview: blogData.preview,
                    blogList: blogData.blogList,
                }
                res.render("blog/edit.ejs", {blogData: data});
            }
            else {
                res.redirect("/home");
            }
        } else {
            res.redirect("/login");
        }
    }
    catch (error) {
        console.log(error)
        res.status(500).send("Internal Server Error");
    }
});

app.post("/blog/edit/:id", async (req, res) => {
    const id = req.params.id;
    try {
        if (req.session && req.session.isLoggedIn) {
            const username = req.session.username;

            const userFilePath = path.join(accountsPath, `${username}.json`);
            const userData = JSON.parse(await fs.readFile(userFilePath, "utf8"));
            
            if (userData.ownedBlogs.includes(parseInt(id))) {
                const blogData = JSON.parse(await fs.readFile(path.join(blogPath, id + ".json"), "utf8"));
                if (!blogData) {
                    throw new Error(`File "${id}.json" is empty or could not be read.`);
                }

                const newData = req.body;

                const data = {
                    author: blogData.author, 
                    title: newData.title, 
                    posted: blogData.posted, 
                    tags: newData.preview, 
                    preview: newData.preview, 
                    blogList: newData.blogList,
                }

                await fs.writeFile(path.join(blogPath, `${id}.json`), JSON.stringify(data));

                res.redirect("/blog/edit/" + id);
            }
            else {
                res.redirect("/home");
            }
        } else {
            res.redirect("/login");
        }
    }
    catch (error) {
        console.log(error)
        res.status(500).send("Internal Server Error");
    }
});

app.get("/blog/new", async (req, res) => {
    res.render("blog/new.ejs");
});

app.post("/blog/new", async (req, res) => {
    const {title} = req.body;

    if (title !== "") {
        try {
            if (req.session && req.session.isLoggedIn) {
                const username = req.session.username;
    
                const userFilePath = path.join(accountsPath, `${username}.json`);
                const userData = JSON.parse(await fs.readFile(userFilePath, "utf8"));
    
                const files = await fs.readdir(blogPath);
                const numbers = files.filter(file => /^\d+\.json$/.test(file)).map(file => parseInt(file.split('.')[0]));
                
                let highestNumber = 0;
                if (numbers.length > 0) {
                    highestNumber = Math.max(...numbers);
                }
    
                const newFileName = highestNumber + 1;
                const fileContent = {author: username, title: title, posted: "", tags: [], preview: "", blogList: []};
    
                await fs.writeFile(path.join(blogPath, `${newFileName}.json`), JSON.stringify(fileContent));
                await fs.mkdir(path.join(blogContentPath, `${newFileName}`));
    
                userData.ownedBlogs.push(newFileName)
                await fs.writeFile(path.join(accountsPath, `${username}.json`), JSON.stringify(userData));
    
                res.redirect(`/blog/edit/${newFileName}`);
            } else {
                res.redirect("/login");
            }
        } catch (error) {
            console.error("Error creating new blog post:", error);
            res.status(500).send("Internal Server Error");
        }
    }
    else {
        res.render("blog/new.ejs");
    }
});

app.get("/blog/:id", async (req, res) => {
    const id = req.params.id;
    try {
        const MainFile = JSON.parse(await fs.readFile(path.join(blogPath, id + ".json"), "utf8"));
        if (!MainFile) {
            throw new Error(`File "${id}.json" is empty or could not be read.`);
        }

        const fileData = {
            id: id,
            title: MainFile.title,
            author: MainFile.author,
            posted: MainFile.posted,
            tags: MainFile.tags,
            preview: MainFile.preview
        }
        res.render("home/index.ejs", { blogs: blogData, activeFilters: {}, blogSearch: ""});
    }
    catch (error) {
        console.log(error)
        res.status(500).send("Internal Server Error");
    }
});

app.get("/home", async (req, res) => {
    try {
        if (req.session && req.session.isLoggedIn) {
            const username = req.session.username;
            const userFilePath = path.join(accountsPath, username + ".json");
    
            const fileData = await fs.readFile(userFilePath, "utf8");
            const userData = JSON.parse(fileData);
    
            const ownedBlogs = userData.ownedBlogs;
            const blogData = await userBlogs(ownedBlogs);
    
            res.render("home/index.ejs", { blogs: blogData, activeFilters: {}, blogSearch: ""});
        } else {
            res.redirect("/login");
        }
    }
    catch (error) {
        console.log(error)
        res.status(500).send("Internal Server Error");
    }
});

app.get("/login", (req, res) => {
    res.render("login/index.ejs");
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const filePath = path.join(accountsPath, `${username}.json`);

    try {
        const userData = await fs.readFile(filePath, "utf8");
        const data = JSON.parse(userData);

        bcrypt.compare(password, data.password, (err, result) => {
            if (result) {
                req.session.username = username;
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
    const filePath = path.join(accountsPath, `${username}.json`);

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
                        req.session.username = username;
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
    try {
        const blogData = await blogs();
        res.render("list/index.ejs", { blogs: blogData, activeFilters: {}, blogSearch: ""});
    } catch (error) {
        console.error("Error rendering view:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
