const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth2').Strategy;
const { Sequelize, DataTypes } = require('sequelize');
const jwt = require('jsonwebtoken');
require('dotenv').config();



const sequelize = new Sequelize('CRM', 'root', 'root', {
    host: 'localhost',
    dialect: 'mysql'
});


sequelize.authenticate()
    .then(() => {
        console.log('Connection has been established successfully.')})
    .catch(error => 
        {console.error('Unable to connect to the database:', error)});


const User = sequelize.define('User', {
    user_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: false
    },
    address: {
        type: DataTypes.STRING,
        allowNull: false
    },
    user_type: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
}, {
    tableName: 'users',
    timestamps: true
});

sequelize.sync({ force: false })
    .then(() => {
        console.log(`Database & tables created!`);
    })
    .catch(error => {
        console.error('Unable to create tables:', error);
    });



function generateAccessToken(user){
    const payload = {
        id: user.id,
        role: user.user_type
    };
    
    const token = jwt.sign(payload, 'secretKey', { expiresIn: "1h" });
    
    return token;
}
passport.use(new GoogleStrategy({
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/google/callback",
    passReqToCallback   : true
  },
  async function(request, accessToken, refreshToken, profile, done) {
    try {
        const [user, created] = await User.findOrCreate({
            where: { email: profile.email },
            defaults: {
                name: profile.displayName, // Set the name based on Google profile
                email: profile.email,
                user_type: 'customer', // Default role
                phone: '', // Set a default value
                address: '', // Set a default value
                password: 'password123' // Default password
            },
        });

        const token = generateAccessToken(user);
        user.token = token;
        
        return done(null, user);
    } catch (err) {
        console.error('Error:', err);
        return done(err, null);
    }
}

));

passport.serializeUser((user, done) => {
    done(null, user);
});
passport.deserializeUser((user, done) => {
    done(null, user);
});