const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const port = 3005;
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
const { validateSaleInput, validateSaleEdit, checkValidationResults } = require('../CRM-Inventory-CustomerSupport-System/middlewares/inputValidation');
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

const Sales = sequelize.define('Sales', {
    sale_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    product_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    total: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, {
    tableName: 'sales',
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


app.post('/addsale', authenticateToken, rateLimit, authPage(["admin", "customer"]), validateSaleInput, checkValidationResults, async (req, res) => {
    const saleObj = {
        user_id: req.body.user_id,
        product_id: req.body.product_id,
        quantity: parseInt(req.body.quantity),
    };

    const token = req.headers.authorization;

    try {
        if (!token) {
            logger.warn('Authorization token is missing.');
            return res.status(401).json({ error: 'Authorization token is missing' });
        }

        const headers = { Authorization: token };

        // Fetch user
        const user = await axios.get(`https://localhost:3001/user/${saleObj.user_id}`, { headers, httpsAgent });
        if (!user || !user.data) {
            logger.warn(`User with ID ${saleObj.user_id} not found.`);
            return res.status(404).send('User not found');
        }
        logger.info('User response:', user.data);

        // Fetch inventory
        const getinventory = await axios.get(`https://localhost:3004/inventory/product/${saleObj.product_id}`, { headers, httpsAgent });
        const inventory = getinventory.data.inventory;
        if (!inventory || inventory.quantity === undefined) {
            logger.warn(`Product with ID ${saleObj.product_id} not found in inventory.`);
            return res.status(404).send('Product not found in inventory');
        }
        logger.info('Inventory response:', getinventory.data);

        // Fetch product details
        const product = await axios.get(`https://localhost:3002/product/${saleObj.product_id}`, { headers, httpsAgent });
        if (!product || !product.data || !product.data.price) {
            logger.warn(`Product with ID ${saleObj.product_id} not found or missing price.`);
            return res.status(404).send('Product details not found');
        }
        logger.info('Product response:', product.data);

        if (inventory.quantity < saleObj.quantity) {
            logger.warn('Not enough quantity in inventory.');
            return res.status(400).send('Not enough quantity in inventory');
        }

        // Update inventory
        await axios.put(`https://localhost:3004/inventory/${inventory.inventory_id}`, {
            product_id: inventory.product_id,
            quantity: inventory.quantity - saleObj.quantity,
        }, { headers, httpsAgent });

        // Calculate total and create sale
        const total = product.data.price * saleObj.quantity;
        saleObj.total = total;

        const sale = await Sales.create(saleObj);
        logger.info('Sale created successfully.', { sale });
        return res.status(200).json(sale);

    } catch (error) {
        logger.error('Error creating sale:', error);
        if (error.response) {
            logger.error('API Response Error:', error.response.data);
        }
        return res.status(500).send('Internal Server Error');
    }
});


app.get('/all', authenticateToken, rateLimit, authPage(["admin"]), async (req, res) => {
    try {
        const sales = await Sales.findAll();
        logger.info('Fetched all sales successfully.', { sales });
        return res.status(200).json(sales);
    } catch (error) {
        logger.error('Error fetching sales:', error);
        return res.status(400).send(error);
    }
});

app.get('/sales/:id', authenticateToken, rateLimit, authPage(["admin", "customer"]), async (req, res) => {
    const id = req.params.id;
    const token = req.headers.authorization;

    try {
        if (!token) {
            logger.warn('Authorization token is missing.');
            return res.status(401).json({ error: 'Authorization token is missing' });
        }

        const headers = { Authorization: token };
        const sale = await Sales.findByPk(id);
        const product = await axios.get(`https://localhost:3002/products/${sale.product_id}`, { headers });
        const user = await axios.get(`https://localhost:3001/users/${sale.user_id}`, { headers });
        sale.dataValues.product = product.data;
        sale.dataValues.user = user.data;

        logger.info('Fetched sale details successfully.', { sale });
        return res.status(200).json({ sale: sale.dataValues });
    } catch (error) {
        logger.error('Error fetching sale details:', error);
        return res.status(400).send(error);
    }
});

app.put('/sale/:id', authenticateToken, rateLimit, authPage(["admin", "customer"]), validateSaleEdit, checkValidationResults, async (req, res) => {
    const saleId = req.params.id;
    const newQuantity = req.body.quantity;
    const token = req.headers.authorization;

    try {
        if (!token) {
            logger.warn('Authorization token is missing.');
            return res.status(401).json({ error: 'Authorization token is missing' });
        }

        const headers = { Authorization: token };
        const sale = await Sales.findByPk(saleId);
        if (!sale) {
            logger.warn('Sale not found.');
            return res.status(404).send('Sale not found');
        }

        const getinventory = await axios.get(`https://localhost:3004/inventory/product/${sale.product_id}`, { headers });
        const inventory = getinventory.data.inventory;
        if (!inventory) {
            logger.warn('Product not found in inventory.');
            return res.status(404).send('Product not found in inventory');
        }

        const quantityDifference = newQuantity - sale.quantity;
        if (inventory.quantity < quantityDifference) {
            logger.warn('Not enough quantity in inventory.');
            return res.status(400).send('Not enough quantity in inventory');
        }

        await axios.put(`https://localhost:3004/inventory/${inventory.inventory_id}`, {
            product_id: inventory.product_id,
            quantity: inventory.quantity - quantityDifference,
            minimum_quantity: inventory.minimum_quantity
        }, { headers });

        const product = await axios.get(`https://localhost:3002/products/${sale.product_id}`, { headers });
        if (!product.data) {
            logger.warn('Product not found.');
            return res.status(404).send('Product not found');
        }

        sale.quantity = newQuantity;
        sale.total = product.data.price * newQuantity;
        await sale.save();

        logger.info('Sale updated successfully.', { sale });
        return res.status(200).json(sale);
    } catch (error) {
        logger.error('Error updating sale:', error);
        return res.status(500).send('Internal Server Error');
    }
});

app.delete('/sale/:id', authenticateToken, rateLimit, authPage(["admin", "customer"]), async (req, res) => {
    const saleId = req.params.id;
    const token = req.headers.authorization;
    try {

        if (!token) {
            logger.warn('Authorization token is missing.');
            return res.status(401).json({ error: 'Authorization token is missing' });
        }

        // Set token in the request headers for axios
        const headers = {
            Authorization: token, // Add the token to the headers
        };

        // Fetch the existing sale record
        const sale = await Sales.findByPk(saleId);
        if (!sale) {
            logger.warn('Sale not found.');
            return res.status(404).send('Sale not found');
        }

        // Fetch the inventory record
        const getinventory = await axios.get(`https://localhost:3004/inventory/product/${sale.product_id}`, { headers });
        const inventory = getinventory.data.inventory;
        if (!inventory) {
            logger.warn('Product not found in inventory.');
            return res.status(404).send('Product not found in inventory');
        }

        // Update the inventory quantity
        await axios.put(`https://localhost:3004/inventory/${inventory.inventory_id}`, {
            product_id: inventory.product_id,
            quantity: inventory.quantity + sale.quantity,
            minimum_quantity: inventory.minimum_quantity
        }, { headers });

        // Delete the sale record
        await sale.destroy();

        logger.info('Sale deleted successfully.', { saleId });
        return res.status(200).send('Sale deleted successfully');
    } catch (error) {
        logger.error('Error deleting sale:', error);
        return res.status(500).send('Internal Server Error');
    }
});


sslServer.listen(port, () => {
    console.log(`Sales service listening at https://localhost:${port}`)
});