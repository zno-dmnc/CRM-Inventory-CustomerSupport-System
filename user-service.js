const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const port = 3001;
const app = express();
const https = require('https');
const path = require('path');
const fs = require('fs');
const logger = require('../CRM-Inventory-CustomerSupport-System/middlewares/logger');
const morgan = require('morgan');
const jwt = require('jsonwebtoken')

const authenticateToken = require('../CRM-Inventory-CustomerSupport-System/middlewares/authMiddleware')
const rateLimit = require('../CRM-Inventory-CustomerSupport-System/middlewares/rateLimiterMiddleware')
const authPage = require('../CRM-Inventory-CustomerSupport-System/middlewares/rbacMiddleware')
const { validateLoginInput, validateUserProfileInput, validateUserProfileEdit, checkValidationResults } = require('../CRM-Inventory-CustomerSupport-System/middlewares/inputValidation');



const sslServer = https.createServer({
    key: fs.readFileSync(path.join(__dirname, 'cert', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'cert', 'cert.pem')),
}, app)


app.use(express.json());
//to download
//http proxy middleware

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

// Morgan for request logging
app.use(morgan('combined', { stream: fs.createWriteStream(path.join(__dirname, 'logs/access.log'), { flags: 'a' }) }));

// Middleware for logging errors and unauthorized access
app.use((req, res, next) => {
    logger.info(`Request: ${req.method} ${req.url} - IP: ${req.ip}`);
    next();
});

function generateAccessToken(user){
    const payload = {
        id: user.id,
        user_type: user.user_type
    };
    
    const token = jwt.sign(payload, 'secretKey', { expiresIn: "1h" });
    
    return token;
}



app.get('/all', authenticateToken, authPage(["admin"]), rateLimit,async (req, res) => {
    logger.info(`GET /all - User: ${req.user ? req.user.id : 'Guest'}`);
    try {
        const users = await User.findAll();
        logger.info(`Fetched all users - Total: ${users.length}`);
        return res.status(200).json(users);
    } catch (error) {
        logger.error(`Error fetching users: ${error.message}`);
        return res.status(400).send(error);
    }
});

app.get('/user/:id', authenticateToken, async (req, res) => {
    const id = req.params.id;
    logger.info(`GET /user/${id} - User: ${req.user ? req.user.id : 'Guest'}`);
    try {
        const user = await User.findByPk(id);
        if (user) {
            logger.info(`Fetched user with ID: ${id}`);
            return res.status(200).json(user);
        } else {
            logger.warn(`User with ID ${id} not found`);
            return res.status(404).send('User not found');
        }
    } catch (error) {
        logger.error(`Error fetching user with ID ${id}: ${error.message}`);
        return res.status(400).send(error);
    }
});




app.post('/register', rateLimit, validateUserProfileInput, checkValidationResults, async (req, res) => {
    const userObj = {
        name: req.body.name,
        phone: req.body.phone,
        address: req.body.address,
        user_type: req.body.user_type,
        email: req.body.email,
        password: req.body.password,
    };
    logger.info(`POST /register - Payload: ${JSON.stringify(userObj)}`);

    try {
        const user = await User.create(userObj);
        logger.info(`User registered with ID: ${user.user_id}`);
        return res.status(201).json(user);
    } catch (error) {
        logger.error(`Error registering user: ${error.message}`);
        return res.status(400).send(error);
    }
});

app.post('/login', rateLimit, validateLoginInput, checkValidationResults, async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    logger.info(`POST /login - Email: ${email}`);

    try {
        const user = await User.findOne({ where: { email: email } });
        if (user && user.password === password) {
            const token = generateAccessToken(user);
            res.cookie('token', token, {
                httpOnly: true,
            });
            logger.info(`User logged in: ${user.email}`);
            return res.status(200).json({
                message: 'Login Successful',
                role: user.user_type,
                token: token,
            });
        } else {
            logger.warn(`Invalid login attempt for email: ${email}`);
            return res.status(400).send('Invalid credentials');
        }
    } catch (error) {
        logger.error(`Error during login: ${error.message}`);
        return res.status(400).send('Invalid credentials');
    }
});


app.put('/user/:id', authenticateToken, validateUserProfileEdit, checkValidationResults, rateLimit, async (req, res) => {
    const id = req.params.id;
    logger.info(`PUT /user/${id} - Payload: ${JSON.stringify(req.body)}`);

    try {
        const user = await User.findByPk(id);
        if (user) {
            Object.assign(user, req.body);
            await user.save();
            logger.info(`User with ID ${id} updated`);
            return res.status(200).json(user);
        } else {
            logger.warn(`User with ID ${id} not found`);
            return res.status(404).send('User not found');
        }
    } catch (error) {
        logger.error(`Error updating user with ID ${id}: ${error.message}`);
        return res.status(400).send(error);
    }
});


app.delete('/user/:id', authenticateToken, authPage(["admin"]), rateLimit, async (req, res) => {
    const id = req.params.id;
    logger.info(`DELETE /user/${id} - User: ${req.user ? req.user.id : 'Guest'}`);

    try {
        const user = await User.findByPk(id);
        if (user) {
            await user.destroy();
            logger.info(`User with ID ${id} deleted`);
            return res.status(200).send('User deleted');
        } else {
            logger.warn(`User with ID ${id} not found`);
            return res.status(404).send('User not found');
        }
    } catch (error) {
        logger.error(`Error deleting user with ID ${id}: ${error.message}`);
        return res.status(400).send(error);
    }
});


sslServer.listen(port, () => {
    console.log(`User service listening at https://localhost:${port}`);
});
