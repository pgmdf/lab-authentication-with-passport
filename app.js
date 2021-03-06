require('dotenv').config();

const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const express = require('express');
const favicon = require('serve-favicon');
const hbs = require('hbs');
const mongoose = require('mongoose');
const logger = require('morgan');
const path = require('path');

const flash = require('connect-flash')

const User = require('./models/User.model');

// require passport, passport-local, express-session
const passport = require('passport')
const session = require('express-session')
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');

// require passport-github
const GitHubStrategy = require('passport-github').Strategy;

// storing in db
const MongoStore = require("connect-mongo")(session);


mongoose
  .connect('mongodb://localhost/auth-with-passport', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true
  })
  .then(x => console.log(`Connected to Mongo! Database name: "${x.connections[0].name}"`))
  .catch(err => console.error('Error connecting to mongo', err));

const app_name = require('./package.json').name;
const debug = require('debug')(`${app_name}:${path.basename(__filename).split('.')[0]}`);

const app = express();
app.use(flash());

// express-session configuration
app.use(session({
  secret: process.env.SECRET,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000
  }, // 1 day
  store: new MongoStore({
    mongooseConnection: mongoose.connection,
    resave: true,
    saveUninitialized: false,
    ttl: 24 * 60 * 60 // 1 day
  })
}));

// associate user with a session // store the user into the session
passport.serializeUser((user, callback) => {
  callback(null, user._id);
});


// it makes the current user available as req.user
passport.deserializeUser((id, callback) => {
  User.findById(id)
    .then(user => {
      callback(null, user);
    })
    .catch(error => {
      callback(error);
    });
});

passport.use(
  new LocalStrategy((username, password, callback) => {
    User.findOne({
        username
      })
      .then(user => {
        if (!user) {
          return callback(null, false, {
            message: 'Incorrect username'
          });
        }
        if (!bcrypt.compareSync(password, user.password)) {
          return callback(null, false, {
            message: 'Incorrect password'
          });
        }
        callback(null, user);
      })
      .catch(error => {
        callback(error);
      });
  })
);

// trying to implement github strategy
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile)
    User.findOrCreate({ githubName: profile.username, githubId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));


  /* (accessToken, refreshToken, profile, cb) => {
    User.findOrCreate({
        githubId: profile.id
      })
      .then(user => {
        if (user) {
          done(null, user);
          return;
        }
        User.create({
            githubId: profile.id
          })
          .then(newUser => {
            done(null, newUser);
          })
          .catch(err => done(err)); // closes User.create()
      })
      .catch(err => done(err)); // closes User.findOne()
  }
)); */

// basic passport setup
app.use(passport.initialize());
app.use(passport.session());


// Middleware Setup
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(cookieParser());

// Express View engine setup

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(favicon(path.join(__dirname, 'public', 'images', 'favicon.ico')));

// default value for title local
app.locals.title = 'Express - Generated with IronGenerator';

// Routes middleware goes here
const index = require('./routes/index.routes');
app.use('/', index);
const authRoutes = require('./routes/auth.routes');
app.use('/', authRoutes);

module.exports = app;