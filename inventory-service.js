const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const port = 3004;
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
const { validateInventoryInput, validateInventoryEdit, checkValidationResults } = require('../CRM-Inventory-CustomerSupport-System/middlewares/inputValidation');
const logger = require('../CRM-Inventory-CustomerSupport-System/middlewares/logger');
const morgan = require('morgan')
const httpsAgent = new https.Agent({  
    rejectUnauthorized: false
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


const Inventory = sequelize.define('Inventory', {
    inventory_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    product_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    minimum_quantity: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, {
    tableName: 'inventory',
    timestamps: true
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


app.post('/addinventory', authenticateToken, rateLimit, authPage(["admin", "supplier"]), validateInventoryInput, checkValidationResults, async (req, res) => {
    const invObj = {
        product_id: req.body.product_id,
        quantity: parseInt(req.body.quantity),
        minimum_quantity: req.body.quantity * 0.05 // Minimum quantity is 5% of quantity
    };

    const token = req.headers.authorization;
    try {
        if (!token) {
            return res.status(401).json({ error: 'Authorization token is missing' });
        }

        const headers = { Authorization: token };
        const product = await axios.get(`https://localhost:3002/product/${invObj.product_id}`, { headers, httpsAgent });
        if (!product) {
            return res.status(400).json({ message: 'Product not found' });
        }

        let inventory = await Inventory.findOne({ where: { product_id: invObj.product_id } });
        if (inventory) {
            inventory.quantity += invObj.quantity;
            inventory.minimum_quantity = inventory.quantity * 0.05;
            await inventory.save();
            logger.info(`Inventory updated successfully: ${JSON.stringify(inventory)}`);
        } else {
            inventory = await Inventory.create(invObj);
            logger.info(`Inventory created successfully: ${JSON.stringify(inventory)}`);
        }
        
        res.status(200).json(inventory);
    } catch (error) {
        logger.error('Error adding inventory:', error);
        res.status(400).json(error);
    }
});

app.get('/inventory/:id', authenticateToken, rateLimit, authPage(["admin", "supplier"]), async (req, res) => {
    const id = req.params.id;
    const token = req.headers.authorization;
    try {
        if (!token) {
            logger.error('Authorization token is missing');
            return res.status(401).json({ error: 'Authorization token is missing' });
        }

        const headers = {
            Authorization: token,
        };

        const inventory = await Inventory.findByPk(id);
        const product = await axios.get(`https://localhost:3002/product/${inventory.product_id}`, { headers, httpsAgent });
        inventory.dataValues.product = product.data;
        logger.info('Inventory retrieved successfully', inventory);
        res.status(200).json({ inventory: inventory.dataValues });
    } catch (error) {
        logger.error('Error retrieving inventory', error);
        res.status(400).json(error);
    }
});

app.get('/inventory/product/:product_id', authenticateToken, rateLimit, authPage(["admin", "supplier"]), async (req, res) => {
    const product_id = req.params.product_id;
    const token = req.headers.authorization;
    try {
        if (!token) {
            logger.error('Authorization token is missing');
            return res.status(401).json({ error: 'Authorization token is missing' });
        }

        const headers = {
            Authorization: token,
        };

        const inventory = await Inventory.findOne({ where: { product_id } });
        if (!inventory) {
            logger.error('Inventory not found');
            return res.status(404).json({ message: 'Inventory not found' });
        }
        const product = await axios.get(`https://localhost:3002/product/${inventory.product_id}`, { headers, httpsAgent });
        inventory.dataValues.product = product.data;
        logger.info('Inventory retrieved successfully', inventory);
        res.status(200).json({ inventory: inventory.dataValues });
    } catch (error) {
        logger.error('Error retrieving inventory', error);
        res.status(400).json(error);
    }
});

app.get('/all', authenticateToken, rateLimit, authPage(["admin", "supplier"]), async (req, res) => {
    try {
        const inventory = await Inventory.findAll();
        logger.info('All inventories retrieved successfully', inventory);
        res.status(200).json(inventory);
    } catch (error) {
        logger.error('Error retrieving all inventories', error);
        res.status(400).json(error);
    }
});

app.put('/inventory/:id', authenticateToken, rateLimit, authPage(["admin", "supplier"]), validateInventoryEdit, checkValidationResults, async (req, res) => {
    const id = req.params.id;
    const invObj = ({
        product_id: req.body.product_id,
        quantity: parseInt(req.body.quantity),
    });

    try {
        const inventory = await Inventory.findByPk(id);
        if (inventory) {
            inventory.product_id = invObj.product_id;
            inventory.quantity = invObj.quantity;

            await inventory.save();
            logger.info('Inventory updated successfully', inventory);
            res.status(200).json(inventory);
        } else {
            logger.error('Inventory not found');
            res.status(400).send('Inventory not found');
        }
    } catch (error) {
        logger.error('Error updating inventory', error);
        res.status(400).json(error);
    }
});

app.delete('/inventory/:id', authenticateToken, rateLimit, authPage(["admin"]), async (req, res) => {
    const id = req.params.id;

    try {
        const inventory = await Inventory.findByPk(id);
        if (inventory) {
            await inventory.destroy();
            logger.info('Inventory deleted successfully', { id });
            res.status(200).send('Inventory deleted');
        } else {
            logger.error('Inventory not found');
            res.status(400).send('Inventory not found');
        }
    } catch (error) {
        logger.error('Error deleting inventory', error);
        res.status(400).json(error);
    }
});



sslServer.listen(port, () => {
    console.log(`Inventory service listening at http://localhost:${port}`)
});