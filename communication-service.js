const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const port = 3007;
const axios = require('axios');

const app = express();
app.use(express.json());
//to download
//http proxy middleware

const https = require('https');
const path = require('path');
const fs = require('fs');
const authenticateToken = require('../CRM-Inventory-CustomerSupport-System/middlewares/authMiddleware')
const rateLimit = require('../CRM-Inventory-CustomerSupport-System/middlewares/rateLimiterMiddleware')
const authPage = require('../CRM-Inventory-CustomerSupport-System/middlewares/rbacMiddleware')
const { validateCommunicationInput, validateCommunicationEdit, checkValidationResults } = require('../CRM-Inventory-CustomerSupport-System/middlewares/inputValidation');
const logger = require('../CRM-Inventory-CustomerSupport-System/middlewares/logger');
const morgan = require('morgan')

const httpsAgent = new https.Agent({
    rejectUnauthorized: false, // Allow self-signed certificates
});

const sslServer = https.createServer({
    key: fs.readFileSync(path.join(__dirname, 'cert', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'cert', 'cert.pem')),
}, app)

const sequelize = new Sequelize('CRM', 'root', 'root', {
    host: 'localhost',
    dialect: 'mysql'
});


sequelize.authenticate()
    .then(() => {
        console.log('Connection has been established successfully.')})
    .catch(error => 
        {console.error('Unable to connect to the database:', error)});

const Communication = sequelize.define('Communication', {
    communication_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    ticket_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    message: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'communications',
    timestamps: false
});

sequelize.sync({ force: false })
    .then(() => {
        console.log('Database & tables created!');
    })
    .catch(error => {
        console.error('Unable to connect to the database:', error);
    });

// Morgan for request logging
app.use(morgan('combined', { stream: fs.createWriteStream(path.join(__dirname, 'logs/access.log'), { flags: 'a' }) }));

// Middleware for logging errors and unauthorized access 
app.use((req, res, next) => {
    logger.info(`Request: ${req.method} ${req.url} - IP: ${req.ip}`);
    next();
});

app.post('/addcomms', authenticateToken, rateLimit, authPage(["admin", "agent", "customer"]), validateCommunicationInput, checkValidationResults, async (req, res) => {
    const comObj = ({
        ticket_id: req.body.ticket_id,
        user_id: req.body.user_id,
        message: req.body.message
    });
    const token = req.headers.authorization;
    if (!token) {
        logger.error('Authorization token is missing');
        return res.status(401).json({ error: 'Authorization token is missing' });
    }

    logger.info(`Adding communication for ticket_id: ${comObj.ticket_id}, user_id: ${comObj.user_id}`);

    const headers = {
        Authorization: token,
    };

    const user = await axios.get(`https://localhost:3001/user/${comObj.user_id}`, { headers, httpsAgent });
    const ticket = await axios.get(`https://localhost:3006/ticket/${comObj.ticket_id}`, { headers, httpsAgent });
    
    if (!ticket.data) {
        logger.error('Ticket not found');
        return res.status(404).send('Ticket not found');
    }
    if (!user.data) {
        logger.error('User not found');
        return res.status(404).send('User not found');
    }
    if (ticket.data.status != 'open') {
        logger.error('Ticket is closed');
        return res.status(400).send('Ticket is closed');
    }
    if (user.data.user_id != ticket.data.user_id && user.data.user_id != ticket.data.support_id) {
        logger.error('User not authorized');
        return res.status(400).send('User not authorized');
    }

    try {
        const comm = await Communication.create(comObj);
        logger.info(`Communication added: ${comm.communication_id}`);
        res.status(200).json(comm);
    } catch (error) {
        logger.error('Error adding communication', error);
        res.status(400).send('Error');
    }
});


//get communications by tickets
app.get('/comms/:ticket_id', authenticateToken, rateLimit, authPage(["admin", "agent", "customer"]), async (req, res) => {
    const ticket_id = req.params.ticket_id;
    logger.info(`Fetching communications for ticket_id: ${ticket_id}`);
    try {
        const comms = await Communication.findAll({ where: { ticket_id: ticket_id } });
        logger.info(`Communications fetched: ${comms.length} found`);
        return res.status(200).json(comms);
    } catch (error) {
        logger.error('Error fetching communications', error);
        return res.status(400).send(error);
    }
});

app.get('/all', authenticateToken, rateLimit, authPage(["admin"]), async (req, res) => {
    logger.info('Fetching all communications');
    try {
        const comms = await Communication.findAll();
        logger.info(`Communications fetched: ${comms.length} found`);
        return res.status(200).json(comms);
    } catch (error) {
        logger.error('Error fetching communications', error);
        return res.status(400).send(error);
    }
});

app.get('/comms/:id', authenticateToken, rateLimit, authPage(["admin"]), async (req, res) => {
    const id = req.params.id;
    logger.info(`Fetching communication with id: ${id}`);
    try {
        const comm = await Communication.findByPk(id);
        if (comm) {
            logger.info(`Communication found: ${comm.communication_id}`);
            return res.status(200).json(comm);
        } else {
            logger.error('Communication not found');
            return res.status(400).send('Communication not found');
        }
    } catch (error) {
        logger.error('Error fetching communication', error);
        return res.status(400).send(error);
    }
});

app.put('/comms/:id', authenticateToken, rateLimit, authPage(["admin", "agent", "customer"]), validateCommunicationEdit, checkValidationResults, async (req, res) => {
    const id = req.params.id;
    const message = req.body.message;

    logger.info(`Updating communication with id: ${id}, new message: ${message}`);

    try {
        const comm = await Communication.findByPk(id);
        if (comm) {
            comm.message = message;
            await comm.save();
            logger.info(`Communication updated: ${comm.communication_id}`);
            return res.status(200).json(comm);
        } else {
            logger.error('Communication not found');
            return res.status(400).send('Communication not found');
        }
    } catch (error) {
        logger.error('Error updating communication', error);
        return res.status(400).send(error);
    }
});

app.delete('/comms/:id', authenticateToken, rateLimit, authPage(["admin", "agent", "customer"]), async (req, res) => {
    const id = req.params.id;

    logger.info(`Deleting communication with id: ${id}`);

    try {
        const comm = await Communication.findByPk(id);
        if (comm) {
            await comm.destroy();
            logger.info(`Communication deleted: ${id}`);
            return res.status(200).send('Communication deleted');
        } else {
            logger.error('Communication not found');
            return res.status(400).send('Communication not found');
        }
    } catch (error) {
        logger.error('Error deleting communication', error);
        return res.status(400).send(error);
    }
});

sslServer.listen(port, () => {
    console.log(`Communication service listening at https://localhost:${port}`)
});