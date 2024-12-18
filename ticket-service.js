const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const port = 3006;
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
const { validateTicketInput, validateTicketEdit, validateTicketUpdate, checkValidationResults } = require('../CRM-Inventory-CustomerSupport-System/middlewares/inputValidation');
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

const Ticket = sequelize.define('Ticket', {
    ticket_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    support_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    subject: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.STRING,
        allowNull: false
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false
    },
    priority: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'tickets',
    timestamps: false
});

sequelize.sync({ force: false })
    .then(() => {
        console.log('Database & tables created!');
    })
    .catch(error => {'Unable to connect to the database:', error});

// Morgan for request logging
app.use(morgan('combined', { stream: fs.createWriteStream(path.join(__dirname, 'logs/access.log'), { flags: 'a' }) }));

// Middleware for logging errors and unauthorized access
app.use((req, res, next) => {
    logger.info(`Request: ${req.method} ${req.url} - IP: ${req.ip}`);
    next();
});

app.post('/createrequest', authenticateToken, rateLimit, validateTicketInput, checkValidationResults, async (req, res) => {
    logger.info('Creating a new ticket request');
    const requestObj = ({
        user_id: req.body.user_id,
        support_id: null,
        subject: req.body.subject,
        description: req.body.description,
        status: "pending",
        priority: "tbd"
    });
    const token = req.headers.authorization;
    if (!token) {
        logger.error('Authorization token is missing');
        return res.status(401).json({ error: 'Authorization token is missing' });
    }

    const headers = {
        Authorization: token,
    };
    
    try {
        const user = await axios.get(`https://localhost:3001/user/${requestObj.user_id}`, { headers, httpsAgent })
        if (!user) {
            logger.error('User not found');
            return res.status(400).json({ error: 'User not found' });
        }
        if (user.data.user_type !== 'customer') {
            logger.error('Only customers can request tickets');
            return res.status(400).json({ error: 'Only customers can request tickets' });
        }

        const ticket = await Ticket.create(requestObj);
        logger.info('Ticket created successfully');
        res.status(200).json(ticket);
    } catch (error) {
        logger.error(`Error creating ticket: ${error.message}`);
        res.status(400).json(error);
    }
});

app.get('/all', authenticateToken, rateLimit, authPage(["admin", "agent"]), async (req, res) => {
    logger.info('Fetching all tickets');
    try {
        const tickets = await Ticket.findAll();
        return res.status(200).json(tickets);
    } catch (error) {
        logger.error(`Error fetching tickets: ${error.message}`);
        return res.status(400).json(error);
    }
});

app.get('/ticket/:id', authenticateToken, rateLimit, authPage(["admin", "agent", "customer"]), async (req, res) => {
    const id = req.params.id;
    logger.info(`Fetching ticket with ID: ${id}`);
    try {
        const ticket = await Ticket.findByPk(id);
        return res.status(200).json(ticket);
    } catch (error) {
        logger.error(`Error fetching ticket: ${error.message}`);
        return res.status(400).json(error);
    }
});


app.put('/createTicket/:id', authenticateToken, rateLimit, authPage(["admin", "customer"]), validateTicketEdit, checkValidationResults, async (req, res) => {
    const id = req.params.id;
    logger.info(`Creating or updating ticket with ID: ${id}`);

    try {
        const getticket = await Ticket.findByPk(id);
        if (!getticket) {
            logger.error('Ticket not found');
            return res.status(400).json({ error: 'Ticket not found' });
        }

        if (getticket.status !== 'pending') {
            logger.error('Ticket already created');
            return res.status(400).json({ error: 'Ticket already created' });
        }

        // Updated ticket object
        const ticketObj = {
            user_id: req.body.user_id,
            support_id: req.body.support_id,
            subject: req.body.subject,
            description: req.body.description,
            status: 'open',
            priority: req.body.priority
        };

        // Update the ticket
        const updatedTicket = await getticket.update(ticketObj);
        logger.info('Ticket updated successfully');
        res.status(200).json(updatedTicket);
    } catch (error) {
        logger.error(`Error creating ticket: ${error.message}`);
        res.status(400).json({ error: error.message });
    }
});



app.put('/closeticket/:id', authenticateToken, rateLimit, authPage(["admin", "agent"]), async (req, res) => {
    const id = req.params.id;
    logger.info(`Closing ticket with ID: ${id}`);
    try {
        const ticket = await Ticket.findByPk(id);
        if (ticket) {
            ticket.status = "closed";
            await ticket.save();
            logger.info('Ticket closed successfully');
            return res.status(200).json(ticket);
        } else {
            logger.error('Ticket not found');
            return res.status(400).send('Ticket not found');
        }
    } catch (error) {
        logger.error(`Error closing ticket: ${error.message}`);
        return res.status(400).send(error);
    }
});

app.put('/updateticket/:id', authenticateToken, rateLimit, authPage(["admin", "customer"]), validateTicketUpdate, checkValidationResults, async (req, res) => {
    const id = req.params.id;
    logger.info(`Updating ticket with ID: ${id}`);
    try {
        const ticket = await Ticket.findByPk(id);
        if (ticket) {
            ticket.user_id = req.body.user_id;
            ticket.support_id = req.body.support_id;
            ticket.status = req.body.status;
            ticket.priority = req.body.priority;

            if(req.body.subject){
                ticket.subject = req.body.subject;
            }
            if(req.body.description){
                ticket.description = req.body.description;
            }

            await ticket.save();
            logger.info('Ticket updated successfully');
            return res.status(200).json(ticket);
        } else {
            logger.error('Ticket not found');
            return res.status(400).send('Ticket not found');
        }
    } catch (error) {
        logger.error(`Error updating ticket: ${error.message}`);
        return res.status(400).send(error);
    }
});

app.delete('/deleteticket/:id', authenticateToken, rateLimit, authPage(["admin"]), async (req, res) => {
    const id = req.params.id;
    logger.info(`Deleting ticket with ID: ${id}`);
    try {
        const ticket = await Ticket.findByPk(id);
        if (ticket) {
            await ticket.destroy();
            logger.info('Ticket deleted successfully');
            return res.status(200).send('Ticket deleted');
        } else {
            logger.error('Ticket not found');
            return res.status(400).send('Ticket not found');
        }
    } catch (error) {
        logger.error(`Error deleting ticket: ${error.message}`);
        return res.status(400).send(error);
    }
});


sslServer.listen(port, () => {
    console.log(`Ticket service listening at https://localhost:${port}`)
});