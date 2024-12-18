const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const port = 3002;

const https = require('https');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
//to download
//http proxy middleware

const logger = require('../CRM-Inventory-CustomerSupport-System/middlewares/logger');
const morgan = require('morgan');

const authenticateToken = require('../CRM-Inventory-CustomerSupport-System/middlewares/authMiddleware')
const rateLimit = require('../CRM-Inventory-CustomerSupport-System/middlewares/rateLimiterMiddleware')
const authPage = require('../CRM-Inventory-CustomerSupport-System/middlewares/rbacMiddleware')
const { validateProductInput, validateProductEditInput, checkValidationResults } = require('../CRM-Inventory-CustomerSupport-System/middlewares/inputValidation');


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


const Product = sequelize.define('Product', {
    product_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.STRING,
        allowNull: false
    },
    price: {
        type: DataTypes.DECIMAL,
        allowNull: false
    }
}, {
    tableName: 'products',
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

app.post('/addproduct', authenticateToken, rateLimit, authPage(["admin", "supplier"]), validateProductInput, checkValidationResults, async (req, res) => {
    const prodObj = {
        name: req.body.name,
        description: req.body.description,
        price: req.body.price,
    };
    logger.info(`POST /addproduct - Payload: ${JSON.stringify(prodObj)}`);

    try {
        const product = await Product.create(prodObj);
        logger.info(`Product added with ID: ${product.product_id}`);
        res.status(200).json(product);
    } catch (error) {
        logger.error(`Error adding product: ${error.message}`);
        res.status(400).json(error);
    }
});

app.get('/all', authenticateToken, rateLimit, async (req, res) => {
    logger.info(`GET /all - Fetching all products`);
    try {
        const products = await Product.findAll();
        logger.info(`Fetched all products - Total: ${products.length}`);
        res.status(200).json(products);
    } catch (error) {
        logger.error(`Error fetching products: ${error.message}`);
        res.status(400).json(error);
    }
});

app.get('/product/:id', authenticateToken, rateLimit, async (req, res) => {
    const id = req.params.id;
    logger.info(`GET /product/${id} - Fetching product details`);
    try {
        const product = await Product.findByPk(id);
        if (product) {
            logger.info(`Fetched product with ID: ${id}`);
            res.status(200).json(product);
        } else {
            logger.warn(`Product with ID ${id} not found`);
            res.status(404).send('Product not found');
        }
    } catch (error) {
        logger.error(`Error fetching product with ID ${id}: ${error.message}`);
        res.status(400).json(error);
    }
});

app.put('/product/:id', authenticateToken, rateLimit, authPage(["admin", "supplier"]), validateProductEditInput, checkValidationResults, async (req, res) => {
    const id = req.params.id;
    const prodObj = {
        name: req.body.name,
        description: req.body.description,
        price: req.body.price,
    };
    logger.info(`PUT /product/${id} - Payload: ${JSON.stringify(prodObj)}`);

    try {
        const product = await Product.findByPk(id);
        if (product) {
            if (prodObj.name) product.name = prodObj.name;
            if (prodObj.description) product.description = prodObj.description;
            if (prodObj.price) product.price = prodObj.price;

            await product.save();
            logger.info(`Product with ID ${id} updated`);
            res.status(200).json(product);
        } else {
            logger.warn(`Product with ID ${id} not found`);
            res.status(404).send('Product not found');
        }
    } catch (error) {
        logger.error(`Error updating product with ID ${id}: ${error.message}`);
        res.status(400).json(error);
    }
});

app.delete('/product/:id', authenticateToken, rateLimit, authPage(["admin"]), async (req, res) => {
    const id = req.params.id;
    logger.info(`DELETE /product/${id} - Attempting to delete product`);
    try {
        const product = await Product.findByPk(id);
        if (product) {
            await product.destroy();
            logger.info(`Product with ID ${id} deleted`);
            res.status(200).send('Product deleted');
        } else {
            logger.warn(`Product with ID ${id} not found`);
            res.status(404).send('Product not found');
        }
    } catch (error) {
        logger.error(`Error deleting product with ID ${id}: ${error.message}`);
        res.status(400).json(error);
    }
});






sslServer.listen(port, () => {
    console.log(`Product service listening at https://localhost:${port}`);
});