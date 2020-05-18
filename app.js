const path = require('path');
const fs = require('fs');

const express = require('express');
const bodyParser = require('body-parser');
const moongoose= require('mongoose');
const session = require('express-session');
const mongoDBStore = require('connect-mongodb-session')(session);
const csrf = require('csurf');
const flash = require('connect-flash');
const multer = require('multer');
const crypto = require('crypto'); 
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;


const errorController = require('./controllers/error');
const User = require('./models/user');

const MONGODB_URI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0-gobgd.mongodb.net/${process.env.MONGO_DEFAULT_DATABASE}?retryWrites=true&w=majority`;
 
// console.log(process.env.NODE_ENV);

const app = express();
const store = new mongoDBStore({ // session storage configure
    uri: MONGODB_URI,
    collection: 'sessions'
    //expire: 
});

//CSRF protection middleware
const csrfProtection = csrf();

const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null,'images') //param: error, destination
    },
    filename: (req, file, cb) =>  {
        cb(null, 
            //crypto.randomBytes(20).toString('hex') 
            new Date().toISOString() + '-' + file.originalname) //param: error, filename
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpg' || file.mimetype === 'image/jpeg') {
        cb(null, true);
    } else {
        cb(null, false);
    }    
}

app.set('view engine', 'ejs');
app.set('views', 'views');

const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');
const authRoutes = require('./routes/auth');


//winston logger to log errors
const myFormat = printf(info => {
    if(info instanceof Error) {
        return `${info.timestamp} [${info.label}] ${info.level}: ${info.message} ${info.stack}`;
    }
    return `${info.timestamp} [${info.label}] ${info.level}: ${info.message}`;
});
  
const logger = createLogger({
    level: 'error',
    format: combine(
        format.splat(),
        label({ label: 'error.log'}),
        timestamp(),
        myFormat,
    ),
    transports: [
        new transports.File({ filename: 'error.log', level: 'error' }),
    ]
});

//fs to log user request for morgan
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), {flags: 'a'}); //flags:a = append new data


app.use(helmet()); //set up http headers for protection
app.use(compression()); //compress css and js served to users to reduce size for faster download on users' ends 
app.use(morgan('combined', {stream: accessLogStream})); //logs user requests

app.use(bodyParser.urlencoded({ extended: false }));
app.use(multer({storage: fileStorage, fileFilter: fileFilter }).single('image')); //image as input name, not file type
app.use(express.static(path.join(__dirname, 'public'))); //static path servering css

app.use('/images', express.static(path.join(__dirname, 'images'))); //static serving images

//session middleware
app.use(session({
    secret: 'my secret', //secret hash 
    resave: false, //session will not be saved on every request, only save on change
    saveUninitialized: false, //session will not be unnecassarily resaved
    store: store  //store session on mongodb
    // cookie: {expires} 
})) 


app.use(csrfProtection);  //any non-GET request will look for CSRF token // csrf();
app.use(flash()); //flash message

app.use((req, res, next) => {
    //locals: local variables to be passed into views
    res.locals.isAuthenticated = req.session.isLoggedIn;
    res.locals.csrfToken = req.csrfToken(); //  csrfToken() is defined by csurf
    next();
})

//middleware to retrive user from session
app.use((req,res,next)=> {
    if (!req.session.userId) {
        return next();
    }
    User.findById(req.session.userId)
        .then(user => {
            if (!user) {
                return next();
            }
            req.user = user; 
            next();
        })
        .catch(err => {
            next(new Error(err));
        });
}); 



app.use('/admin', adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);


app.get('/500', errorController.get500);
app.use(errorController.get404);

//error handling middleware, all raised error would be directed straight to here 
app.use((error, req, res, next) => {
    console.log(error);
    logger.error(error);
    res.status(500).render('500', { 
        pageTitle: 'Error', 
        path: '/500'
      });
})


moongoose.connect(MONGODB_URI, {useNewUrlParser: true, useUnifiedTopology: true})
    .then(result => {
        app.listen(process.env.PORT || 3000);
    })
    .catch(err => console.log(err));

