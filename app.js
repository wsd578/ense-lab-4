// other requires
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const { runInNewContext } = require("vm");
const Mongoose  = require("mongoose");

const session = require("express-session")
const passport = require("passport")
const passportLocalMongoose = require("passport-local-mongoose")
const app = express();

app.use(express.static("public"));     
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
    extended: true
}));

const registerKey = "123456"; // secure!
app.use(passport.initialize());
app.use(passport.session());

Mongoose.connect('mongodb://localhost:27017/testdb',{useNewUrlParser:true,
                    useUnifiedTopology:true});

mongoose.connection.on('error', err => {
  logError(err);
});

const userSchema = new Mongoose.Schema({
    username: String,
    password: String
});
userSchema.plugin(passportLocalMongoose);
const User = Mongoose.model("User", userSchema);

const taskSchema = new Mongoose.Schema({
    _id: Mongoose.Schema.Types.ObjectId,
    name: String,
    owner: [{id: Mongoose.Schema.Types.ObjectId, ref: userSchema}],
    creator:[{id: Mongoose.Schema.Types.ObjectId, ref: userSchema}],
    done: Boolean,
    cleared:Boolean
});

const Task = Mongoose.model("Task",taskSchema);
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

function saveToJson (fileName, obj) {
    fs.writeFileSync(fileName, JSON.stringify(obj), "utf8",  function(err) {
        if (err) return console.log(err);
    });
}
function loadFromJSON (fileName) {
    let fileContents = fs.readFileSync(fileName, "utf8", function(err) {
        if (err) return console.log(err);
    });
    let fileObject = JSON.parse(fileContents);
    return fileObject;
}
let userList = userSchema;
let taskList = taskSchema;
function loadUsers() {
    userList = loadFromJSON (__dirname + "/users.json");
}
function saveUsers() {
    saveToJson (__dirname + "/users.json", userList);
}
function loadTasks() {
    taskList = loadFromJSON (__dirname + "/tasks.json");
}
function saveTasks() {
    saveToJson (__dirname + "/tasks.json", taskList);
}

app.listen(3000, function () {
    console.log("Server started on port 3000");
})

app.get("/", function (req, res) {
    res.render("login", { test: "Prototype" });
});

app.post("/register", function (req, res) {
    saveUsers();
    console.log("Register User");
    User.register({username: req.body.username}, req.body.password, registerKey, function(err, user){
        if (err) {
            console.log(err);
            res.redirect("/")
        } else {
            passport.authenticate("local")(req, res, function(){
                res.redirect(307, "/todo")
            });
        }
    });
});

app.post("/login", function (req, res) {
    const user = new User ({
        username: req.body.username,
        password: req.body.password
     });
    req.login (user, function(err) {
        if (err) {
            console.log(err);
            res.redirect("/")
        } else {
            passport.authenticate("local")(req, res, function() {
                res.redirect(307, "/todo"); 
            });
        }
    });
});

app.post("/todo", function (req, res) {
    loadTasks();
    loadUsers();
        res.render("todo", {
            username: req.body.username,
            items: taskList
        });
        
})

app.get("/logout", function (req, res) {
    console.log("A user logged out")
    req.logout();
    res.redirect("/");
});

app.post("/addtask", function (req, res) {
    const user = new User ({
        username: req.body.username,
     });
    for (user of userList){
        if (user === req.body.username) {
            taskList.add(new Task(taskList.length,
                                   req.body.newTask,
                                   undefined,
                                   user,
                                   false,
                                   false));
            saveTasks();
            res.redirect(307, "/todo");
        }
    }
});

app.post("/claim", function (req, res) {
    console.log(req.body);
    for (user of userList){
        if (user.username === req.body.username) {
            for (task of taskList) {
                if(task._id === parseInt(req.body.taskId)) {
                    task.owner = user;
                    saveTasks();
                    res.redirect(307, "/todo");
                }
            }
        }
    }
})

app.post("/abandonorcomplete", function (req, res) {
    if (req.body.checked === "on") {
        for (task of taskList) {
            if(task._id === parseInt(req.body.taskId)) {
                task.done = true;
                saveTasks();
                res.redirect(307, "/todo");
            }
        }
    } else {
        for (task of taskList) {
            if(task._id === parseInt(req.body.taskId)) {
                task.owner = undefined;
                saveTasks();
                res.redirect(307, "/todo");
            }
        }
    }
});

app.post("/unfinish", function (req, res) {
    for (task of taskList) {
        if(task._id === parseInt(req.body.taskId)) {
            task.done = false;
            saveTasks();
            res.redirect(307, "/todo");
        }
    }
});

app.post("/purge", function (req, res) {
    for (task of taskList) {
        if(task.done === true) {
            task.cleared = true;
        }
    }
    saveTasks();
    res.redirect(307, "/todo");
});