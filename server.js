import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import mongoose from 'mongoose'
import crypto from 'crypto'
import bcrypt from 'bcrypt-nodejs'
import dotenv from 'dotenv'
import cloudinary from 'cloudinary'
import multer from 'multer'
import cloudinaryStorage from 'multer-storage-cloudinary'

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/arosAPI"
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
mongoose.Promise = Promise

const User = mongoose.model('User', {
  name: {
    type: String,
    minlength: 3
  },
  email: {
    type: String,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString('hex')
  },
  isAdmin: {
    type: Boolean,
    default: false
  }
})

const News = mongoose.model('News', {
  title: {
    type: String,
    minlength: 3
  },
  shortSynopsis: {
    type: String,
    minlength: 3
  },
  synopsis: {
    type: String,
    minlength: 3
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  imageUrl: {
    type: String,
  },

  imageId: {
    type: String
  }
})


dotenv.config()

cloudinary.config({
  cloud_name: 'dffbqjwiv', // this is what you get from cloudinary
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

const storage = cloudinaryStorage({
  cloudinary,
  folder: 'images',
  allowedFormats: ['jpg', 'png'],
  transformation: [{ width: 500, height: 500, crop: "limit" }]
})
const parser = multer({ storage })


// Defines the port the app will run on. Defaults to 8080, but can be 
// overridden when starting the server. For example:
//
//   PORT=9000 npm start
const port = process.env.PORT || 8080
const app = express()

// Add middlewares to enable cors and json body parsing
// This is the middleware to authenticate a member/user
const authenticateUser = async (req, res, next) => {
  try {
    const user = await User.findOne({ accessToken: req.header('Authorization') })
    if (user) {
      req.user = user
      next()
    } else {
      // It can also be written:
      // res.status(401).json ({loggedOut: true})
      res.status(401).json({ loggedIn: false, message: 'Please try logging in again' })
    }
  } catch (err) {
    res.status(403).json({ message: 'Access token missing or invalid', errors: err.errors })
  }
}

// this is a middleware to authenticare a person that has Admin tag true
const authenticateAdmin = async (req, res, next) => {
  try {
    const user = await User.findOne({ accessToken: req.header('Authorization') })
    if (user && user.isAdmin) {
      req.user = user
      next()
    } else {
      res.status(401).json({ message: 'not Admin' })
    }
  } catch (err) {
    res.status(403).json({ message: 'Access token missing or invalid', errors: err.errors })
  }
}

app.use(cors())
app.use(bodyParser.json())

// Start defining your routes here
app.get('/', (req, res) => {
  res.send('Hello Ivett')
})

//Seeded data for admin

const adminUser = new User({
  name: "Admin",
  email: "admin@admin.com",
  password: () => bcrypt.hashSync("testtest"),
  isAdmin: true
})
adminUser.save()



// Register User/Member only authorized users/ users with tag Admin can do it.
app.post('/registerMembers', authenticateAdmin)
app.post('/registerMembers', async (req, res) => {
  console.log('ivett')
  // try to register the user
  try {
    const { name, email, password, isAdmin } = req.body
    if (email.match(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/)) {
      // it is very important to encrypt the passwords and store them encrypted in our db!
      const user = new User({ name: name, email: email, password: bcrypt.hashSync(password), isAdmin: isAdmin })
      await user.save()
      res.status(201).json({ id: user._id, name: user.name, accessToken: user.accessToken, isAdmin: user.isAdmin })
      console.log({ user })
      // if the user is not registered, then we catch the error
    } else {
      console.log("Bad email address!")
      res.status(400).json({ message: 'Invalid email', errors: err.errors })
    }
  } catch (err) {
    console.log("Error: " + err)
    res.status(400).json({ message: 'Could not create user', errors: err.errors })
  }
})

//these end points are protected by the authenticateUser function above! This gives info or possibility to change data in the database to members
// Like Otterdalen: Min startsida, ändra uppgifter/inställningar (settings), dokument, matrikel (hämta data för user), hoppkonto,Loggbok, bokning av arbetsdagar  
app.post('/settings', authenticateUser)
app.post('/settings', async (req, res) => {
  // display : name, password, 
  res.json({ message: 'you got access to the members only section' })

})

// authentication access point (login/sign in)
app.post('/login', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email })
    if (user && bcrypt.compareSync(req.body.password, user.password)) {
      //Successful
      res.status(200).json({ userId: user._id, accessToken: user.accessToken, name: user.name, loggedIn: true, isAdmin: user.isAdmin })
    } else {
      //Failure:
      // a) user does not exist
      // b) the encrypted password does not match
      if (user === null)
        res.status(404).json({ notFound: true })
      else res.status(401).json({ message: 'Username or password are incorrect' })
    }
  } catch (err) {
    res.status(404).json({ message: 'Could not find user', errors: err.errors })
  }
})

//Autorization for Admin users to get the super secret pages and only available for authenticated administrators 
app.get('/secretPages/', authenticateAdmin)
app.get('/secretPages/', async (req, res) => {
  try {
    // const secretPages = await SecretPages.find({
    // userId: mongoose.Types.ObjectId(req.params.id) })
    // .sort({ createdAt: 'desc' }).limit(8).exec()
    // res.status(200).json(secretPages)
    res.send('hola')
  } catch (err) {
    res.status(404).json({ message: 'Could not find secret pages', errors: err.errors })
  }
})


//Post to add images to cloudinary and to add title, short synopsis, synopsis and date of the news in mongodb
app.post('/news', authenticateAdmin)
app.post('/news', parser.single('image'), async (req, res) => {
  // console.log(req.file)
  // res.send('Viva,viva!')
  const news = new News({
    title: req.body.title,
    synopsis: req.body.synopsis,
    shortSynopsis: req.body.shortSynopsis,
    createdAt: req.body.createdAt,
    imageUrl: req.file.secure_url,
    imageId: req.file.public_id
  })
  await news.save()
  res.json(news)
})
// get(read) all the news posted by the admin into the database,
// sort them by date in a descendent way and limit them to 18
app.get('/news/newsList', async (req, res) => {
  const newsList = await News.find().sort({ createdAt: 'desc' })
    .limit(18)
    .exec()
  res.json(newsList)
})

// get a specific news by id
app.get('/news/:id', (req, res) => {
  News.findOne({ _id: req.params.id }).then(news => {
    if (news) {
      res.json(news)
    } else {
      res.status(404).json({ error: 'Not found', error: err.errors })
    }
  })
})


// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
