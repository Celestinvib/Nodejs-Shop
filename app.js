const path = require('path');
// const fs = require('fs');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const csrf = require('csurf');
const flash = require('connect-flash');
const multer = require('multer');

const helmet = require('helmet');
const compression = require('compression');
// const morgan = require('morgan');

const errorController = require('./controllers/error');
const User = require('./models/user');



const MONGODB_URI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0.dwn83ww.mongodb.net/${process.env.MONGO_DB}`;

const app = express();
const store = new MongoDBStore({
  uri: MONGODB_URI,
  collection: 'sessions'
});
const csrfProtection = csrf(); //This is a middleware

app.set('view engine', 'ejs');
app.set('views', 'views');

const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');
const authRoutes = require('./routes/auth');

app.use(bodyParser.urlencoded({ extended: false }));

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    //first argument would be an error msj trown , second folder destination
    cb(null, 'images');
  },
  filename: (req, file, cb) => { // Get the actual date & the file name to not match multiples files with the same name on the db (Not perfect)
    cb(null,new Date().getTime() + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  if(
    file.mimetype === 'image/png' || 
    file.mimetype === 'image/jpg' || 
    file.mimetype === 'image/jpeg'
    ) {
      cb(null,true);

  }else{
    cb(null,false);
  }
}


app.use(helmet());
app.use(compression());

//
// const accesLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), 
// { flags: 'a'}
// );

// app.use(morgan('combined', {stream: accesLogStream}));


//We use the next middleware indicating that only one(single) file will be send and its name on the html body is image
app.use(multer({ 
  storage: fileStorage, fileFilter: fileFilter }).single('image'));
//Static  -> req to files in the folders will be handle automatically & the files will be returned by express
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images',express.static(path.join(__dirname, 'images')));
app.use(
  session({
    secret: 'my secret',
    resave: false,
    saveUninitialized: false,
    store: store
  })
);

app.use(csrfProtection); 
//Inicialite flash after creating the session
app.use(flash()); 

//We put the next middleware above the UserFindById middleware due error handiling (to allow the server to load the server problem page)

//Every request this views will be render this fields 
//We have to include the token in all formas of the page
app.use((req,res,next)=> {
  res.locals.isAuthenticated = req.session.isLoggedIn;
  res.locals.csrfToken = req.csrfToken();//Method provided by csurf package check if a request via from has the token
  next();
})

app.use((req, res, next) => {
      // throw new Error('Sync error');
  if (!req.session.user) {
    return next();
  }
  User.findById(req.session.user._id)
    .then(user => {
      // throw new Error('Async error');
      
      if(!user) { //If we can't find the user (maybe it has been deleted) we carry on without login
        return next();
      }
      req.user = user;
      next();
    })
    .catch(err => { //If we have a technical issue connecting to the db 
      //In Asynchronous code like this next has to be use in order to allow express that an error has been thrown it can't be thrown without it (the app crashes)
      next(new Error(err));  
    });
});


app.use('/admin', adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.use('/500',errorController.get500);

app.use(errorController.get404);

//Error special middleware
app.use((error,req,res,next) => {
 // res.status(error.httpStatusCode).render(...);
  // res.redirect('/500');
  res.status(500).render('500', {
    pageTitle: 'Server Error!',
    path: '/500',
    isAuthenticated: req.session.isLoggedIn
  });
});

mongoose
  .connect(MONGODB_URI)
  .then(result => {
    app.listen(process.env.PORT || 3000); //in the web that the deploys are made we'll use the env var PORT in local 3000
  })
  .catch(err => {
    console.log(err);
  });
