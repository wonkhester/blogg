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
const imgPath = path.join(dataBasePath, "images");

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '100mb' }));
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

                if (fileData.posted === "") {
                    return null;
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
                    posted: fileData.posted === "" ? "Not posted" : fileData.posted,
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

                const builtBlogList = blogData.blogList.map(async (blog) => {
                    const images = await Promise.all(blog.images.map(async (id) => {
                        const src = await fs.readFile(path.join(imgPath, id + ".db"), "utf8");
                        return { src };
                    }));
                    return {
                        title: blog.title,
                        date: blog.date,
                        images: images,
                        content: blog.content
                    };
                });
                
                const data = {
                    id: id,
                    title: blogData.title,
                    posted: blogData.posted, 
                    tags: blogData.tags,
                    preview: blogData.preview,
                    blogList: await Promise.all(builtBlogList),
                };


                res.render("blog/edit.ejs", { blogData: data, edit: true});
            }
            else {
                res.redirect("/home");
            }
        } else {
            res.redirect("/login");
        }
    }
    catch (error) {
        console.log(error);
        res.status(500).send("Internal Server Error");
    }
});

app.post("/blog/edit/:id", async (req, res) => {
    const id = req.params.id;
    const newData = req.body;

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

                const files = await fs.readdir(imgPath);

                const builtBlogList = [];
                for (const blog of newData.blogList) {
                    const images = [];
                    for (const img of blog.images) {
                        var foundDubble = false;
                        for (const fileName of files) {
                            const fileData = await fs.readFile(path.join(imgPath, fileName), "utf8");
                            if (fileData === img.src) {
                                foundDubble = true;
                                images.push(parseInt(fileName.split('.')[0]));
                                break;
                            }
                        }
                        if (foundDubble) {
                            continue;
                        }

                        const numbers = files.map(file => parseInt(file.split('.')[0]));
                        var highestNumber = 0;
                        if (numbers.length > 0) {
                            highestNumber = Math.max(...numbers);
                        }
                        const newNumber = highestNumber + 1;

                        files.push(newNumber + ".db");
                        await fs.writeFile(path.join(imgPath, `${newNumber}.db`), img.src);
                        images.push(newNumber);
                    }
                    builtBlogList.push({
                        title: blog.title,
                        date: blog.date,
                        images: images,
                        content: blog.content
                    });
                }
                
                const data = {
                    id: id,
                    author: blogData.author,
                    title: newData.title,
                    posted: blogData.posted, 
                    tags: newData.tags,
                    preview: newData.preview,
                    blogList: await Promise.all(builtBlogList),
                    comments: blogData.comments, 
                };
                

                await fs.writeFile(path.join(blogPath, `${id}.json`), JSON.stringify(data));
                res.redirect("/blog/edit/" + id);
            } else {
                res.redirect("/home");
            }
        } else {
            res.redirect("/login");
        }
    } catch (error) {
        console.log(error);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/blog/delete/:id", async (req, res) => {
    const id = req.params.id;
    try {
        if (req.session && req.session.isLoggedIn) {
            const username = req.session.username;

            const userFilePath = path.join(accountsPath, `${username}.json`);
            const userData = JSON.parse(await fs.readFile(userFilePath, "utf8"));
            
            if (userData.ownedBlogs.includes(parseInt(id))) {
                res.render("blog/delete.ejs", { id: id });
            }
        }
        else {
            res.redirect("/");
        }
    }
    catch (error) {
        console.log(error);
        res.status(500).send("Internal Server Error");
    }
});

app.post("/blog/delete/:id", async (req, res) => {
    const id = req.params.id;
    try {
        if (req.body.input === "YES") {
            if (req.session && req.session.isLoggedIn) {
                const username = req.session.username;
    
                const userFilePath = path.join(accountsPath, `${username}.json`);
                const userData = JSON.parse(await fs.readFile(userFilePath, "utf8"));
                
                if (userData.ownedBlogs.includes(parseInt(id))) {
                    await fs.unlink(path.join(blogPath, `${id}.json`));

                    const blogId = userData.indexOf(id);
                    delete userData[blogId];

                    await fs.writeFile(path.join(accountsPath, `${username}.json`), userData);

                    res.redirect("/home");
                }
            }
            else {
                res.redirect("/");
            }
        }
        else {
            res.redirect("/");
        }
    }
    catch (error) {
        console.log(error);
        res.status(500).send("Internal Server Error");
    }
});

app.post("/blog/comment/:id", async (req, res) => {
    const id = req.params.id;
    try {
        if (req.session && req.session.isLoggedIn) {
            const username = req.session.username;

            const comment = req.body.commentInput;
            
            const blogData = JSON.parse(await fs.readFile(path.join(blogPath, id + ".json"), "utf8"));
                
            if (!blogData) {
                throw new Error(`File "${id}.json" is empty or could not be read.`);
            }

            blogData.comments.push({poster: username, comment: comment})

            await fs.writeFile(path.join(blogPath, `${id}.json`), JSON.stringify(blogData));

            res.redirect("/blog/" + id);
        }
        else {
            const comment = req.body.commentInput;
            
            const blogData = JSON.parse(await fs.readFile(path.join(blogPath, id + ".json"), "utf8"));
                
            if (!blogData) {
                throw new Error(`File "${id}.json" is empty or could not be read.`);
            }

            blogData.comments.push({poster: "Guest", comment: comment})

            await fs.writeFile(path.join(blogPath, `${id}.json`), JSON.stringify(blogData));

            res.redirect("/blog/" + id);
        }
    }
    catch (error) {
        console.log(error);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/blog/post/:id", async (req, res) => {
    const id = req.params.id;

    try {
        if (req.session && req.session.isLoggedIn) {
            const username = req.session.username;
            const userFilePath = path.join(accountsPath, `${username}.json`);
            const userData = JSON.parse(await fs.readFile(userFilePath, "utf8"));
            
            if (userData.ownedBlogs.includes(parseInt(id))) {
                var blogData = JSON.parse(await fs.readFile(path.join(blogPath, id + ".json"), "utf8"));

                if (blogData.posted === "") {
                    blogData.posted = new Date().toISOString().slice(0,10);
                }
                else {
                    blogData.posted = "";
                }

                await fs.writeFile(path.join(blogPath, `${id}.json`), JSON.stringify(blogData));

                res.redirect("/home");
            }
            else {
                res.redirect("/home");
            }
        }
        else {
            res.redirect("/login");
        }
    }
    catch (error) {
        console.log(error);
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
                const fileContent = {author: username, title: title, posted: "", tags: [], preview: "", blogList: [], comments: []};
    
                await fs.writeFile(path.join(blogPath, `${newFileName}.json`), JSON.stringify(fileContent));
    
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
        const blogData = JSON.parse(await fs.readFile(path.join(blogPath, id + ".json"), "utf8"));
        if (!blogData) {
            throw new Error(`File "${id}.json" is empty or could not be read.`);
        }
        
        const builtBlogList = async () => {
            return Promise.all(blogData.blogList.map(async (blog) => {
                const images = await Promise.all(blog.images.map(async (id) => {
                    const src = await fs.readFile(path.join(imgPath, id + ".db"), "utf8");
                    return { src };
                }));
                return {
                    title: blog.title,
                    date: blog.date,
                    images: images,
                    content: blog.content
                };
            }));
        };
        
        const data = {
            id: id,
            author: blogData.author,
            title: blogData.title,
            posted: blogData.posted, 
            blogList: await builtBlogList(),
            comments: blogData.comments,
        };

        res.render("blog/index.ejs", { blogData: data, edit: false });
    }
    catch (error) {
        console.log(error);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/home/:data", async (req, res) => {
    try {
        if (req.session && req.session.isLoggedIn) {

            const data = JSON.parse(req.params.data);
            const activeFilters = data.filters || [];
            const blogSearch = data.search || "";

            const username = req.session.username;
            const userFilePath = path.join(accountsPath, username + ".json");
    
            const fileData = await fs.readFile(userFilePath, "utf8");
            const userData = JSON.parse(fileData);
    
            const ownedBlogs = userData.ownedBlogs;
            const allBlogData = await userBlogs(ownedBlogs);

            const filterBlogData = activeFilters.length > 0 ? allBlogData.filter(blog => {
                return activeFilters.every(filter => blog.tags.includes(filter));
            }) : allBlogData;

            const titleBlogData = blogSearch ? filterBlogData.filter(item => item.title.toLowerCase().includes(blogSearch.toLowerCase())) : filterBlogData;
            const authorBlogData = blogSearch ? filterBlogData.filter(item => item.author.toLowerCase().includes(blogSearch.toLowerCase())) : filterBlogData;

            const finalData = [...new Set([...titleBlogData, ...authorBlogData])];
    
            res.render("home/index.ejs", { blogs: finalData, activeFilters: JSON.stringify(activeFilters), blogSearch: blogSearch});
        } else {
            res.redirect("/login");
        }
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
    
            res.render("home/index.ejs", { blogs: blogData, activeFilters: [], blogSearch: ""});
        } else {
            res.redirect("/login");
        }
    }
    catch (error) {
        console.log(error)
        res.status(500).send("Internal Server Error");
    }
});

app.get("/logout", async (req, res) => {
    try {
        req.session.username = null;
        req.session.isLoggedIn = false;
        res.redirect("/");
    } catch (error) {
        console.log(error)
        res.redirect("/");
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

app.get("/:data", async (req, res) => {
    try {
        const data = JSON.parse(req.params.data);
        const activeFilters = data.filters || [];
        const blogSearch = data.search || "";

        const allBlogData = await blogs();

        const filterBlogData = activeFilters.length > 0 ? allBlogData.filter(blog => {
            return activeFilters.every(filter => blog.tags.includes(filter));
        }) : allBlogData;

        const titleBlogData = blogSearch ? filterBlogData.filter(item => item.title.toLowerCase().includes(blogSearch.toLowerCase())) : filterBlogData;
        const authorBlogData = blogSearch ? filterBlogData.filter(item => item.author.toLowerCase().includes(blogSearch.toLowerCase())) : filterBlogData;

        const finalData = [...new Set([...titleBlogData, ...authorBlogData])];

        res.render("list/index.ejs", { blogs: finalData, activeFilters: JSON.stringify(activeFilters), blogSearch: blogSearch, isLoggedIn: req.session.isLoggedIn });
    } catch (error) {
        console.error("Error occurred:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.get("/", async (req, res) => {
    try {
        const blogData = await blogs();
        res.render("list/index.ejs", { blogs: blogData, activeFilters: [], blogSearch: "", isLoggedIn: req.session.isLoggedIn});
    } catch (error) {
        console.error("Error rendering view:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
