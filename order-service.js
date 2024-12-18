const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const port = 3003;
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
const { validateNewOrdersInput, validateEditOrdersInput, checkValidationResults } = require('../CRM-Inventory-CustomerSupport-System/middlewares/inputValidation');
const logger = require('../CRM-Inventory-CustomerSupport-System/middlewares/logger');
const morgan = require('morgan');

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

    
const Order = sequelize.define('Order', {
    order_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    supplier_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    product_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    order_quantity: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, {
    tableName: 'order',
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

app.post('/addorder', authenticateToken, rateLimit, authPage(["admin", "supplier"]), validateNewOrdersInput, checkValidationResults, async (req, res) => {
    const orderObj = {
        supplier_id: req.body.supplier_id,
        product_id: req.body.product_id,
        order_quantity: req.body.order_quantity,
    };
    const token = req.headers.authorization;
    logger.info(`POST /addorder - Payload: ${JSON.stringify(orderObj)}`);
    
    try {
        if (!token) {
            logger.warn('Authorization token is missing');
            return res.status(401).json({ error: 'Authorization token is missing' });
        }

        const headers = { Authorization: token };
        const product = await axios.get(`https://localhost:3002/product/${orderObj.product_id}`, { headers, httpsAgent });
        if (!product.data) {
            logger.warn(`Product with ID ${orderObj.product_id} not found`);
            return res.status(400).json({ message: 'Product not found' });
        }
        const user = await axios.get(`https://localhost:3001/user/${orderObj.supplier_id}`, { headers, httpsAgent });
        if (!user.data) {
            logger.warn(`Supplier with ID ${orderObj.supplier_id} not found`);
            return res.status(400).json({ message: 'Supplier not found' });
        }
        const addinventory = await axios.post('https://localhost:3004/addinventory', {
            product_id: orderObj.product_id,
            quantity: orderObj.order_quantity,
        }, { headers, httpsAgent });

        if (addinventory.status === 200) {
            const order = await Order.create(orderObj);
            logger.info(`Order created successfully: ${JSON.stringify(order)}`);
            res.status(200).json({ order: order, updatedInventory: addinventory.data });
        } else {
            logger.warn('Inventory not added');
            res.status(400).json({ message: 'Inventory not added' });
        }
    } catch (error) {
        logger.error(`Error creating order: ${error.message}`);
        logger.error(error.stack);  // Log the full stack trace
        res.status(400).json({ message: 'Error creating order', error: error.message });
    }
});

app.get('/all', authenticateToken, rateLimit, authPage(["admin", "supplier"]), async (req, res) => {
    logger.info('GET /all - Fetching all orders');
    try {
        const orders = await Order.findAll();
        logger.info(`Fetched ${orders.length} orders`);
        res.status(200).json(orders);
    } catch (error) {
        logger.error(`Error fetching orders: ${error.message}`);
        res.status(400).json({ error: 'Error fetching orders' });
    }
});

app.get('/order/:id', authenticateToken, rateLimit, authPage(["admin", "supplier"]), async (req, res) => {
    const id = req.params.id;
    const token = req.headers.authorization;
    logger.info(`GET /order/${id} - Fetching order details`);

    try {
        if (!token) {
            logger.warn('Authorization token is missing');
            return res.status(401).json({ error: 'Authorization token is missing' });
        }

        const headers = { Authorization: token };
        const order = await Order.findByPk(id);
        if (!order) {
            logger.warn(`Order with ID ${id} not found`);
            return res.status(404).send('Order not found');
        }

        const product = await axios.get(`https://localhost:3002/products/${order.product_id}`, { headers, httpsAgent });
        const supplier = await axios.get(`https://localhost:3001/users/${order.supplier_id}`, { headers, httpsAgent });

        order.dataValues.product = product.data;
        order.dataValues.supplier = supplier.data;

        logger.info(`Order details fetched: ${JSON.stringify(order.dataValues)}`);
        res.status(200).json({ order: order.dataValues });
    } catch (error) {
        logger.error(`Error fetching order with ID ${id}: ${error.message}`);
        res.status(400).send(error);
    }
});


app.put('/order/:id', authenticateToken, rateLimit, authPage(["admin", "supplier"]), validateEditOrdersInput, checkValidationResults, async (req, res) => {
    const id = req.params.id;
    const orderObj = {
        supplier_id: req.body.supplier_id,
        product_id: req.body.product_id,
        order_quantity: req.body.order_quantity,
    };
    const token = req.headers.authorization;
    logger.info(`PUT /order/${id} - Payload: ${JSON.stringify(orderObj)}`);

    try {
        if (!token) {
            logger.warn('Authorization token is missing');
            return res.status(401).json({ error: 'Authorization token is missing' });
        }

        const headers = { Authorization: token };
        const supplier = await axios.get(`https://localhost:3001/users/${orderObj.supplier_id}`, { headers, httpsAgent });
        if (!supplier.data) {
            logger.warn(`Supplier with ID ${orderObj.supplier_id} not found`);
            return res.status(400).json({ message: 'Supplier not found' });
        }
        const product = await axios.get(`https://localhost:3002/products/${orderObj.product_id}`, { headers, httpsAgent });
        if (!product.data) {
            logger.warn(`Product with ID ${orderObj.product_id} not found`);
            return res.status(400).json({ message: 'Product not found' });
        }

        const order = await Order.findByPk(id);
        if (order) {
            if (orderObj.supplier_id) order.supplier_id = orderObj.supplier_id;
            if (orderObj.product_id) order.product_id = orderObj.product_id;
            if (orderObj.order_quantity) order.order_quantity = orderObj.order_quantity;

            await order.save();
            logger.info(`Order with ID ${id} updated: ${JSON.stringify(order)}`);
            res.status(200).json(order);
        } else {
            logger.warn(`Order with ID ${id} not found`);
            res.status(404).send('Order not found');
        }
    } catch (error) {
        logger.error(`Error updating order with ID ${id}: ${error.message}`);
        res.status(400).send(error);
    }
});

app.delete('/order/:id', authenticateToken, rateLimit, authPage(["admin", "supplier"]), async (req, res) => {
    const id = req.params.id;
    logger.info(`DELETE /order/${id} - Attempting to delete order`);

    try {
        const order = await Order.findByPk(id);
        if (order) {
            await order.destroy();
            logger.info(`Order with ID ${id} deleted`);
            res.status(200).send('Order deleted');
        } else {
            logger.warn(`Order with ID ${id} not found`);
            res.status(404).send('Order not found');
        }
    } catch (error) {
        logger.error(`Error deleting order with ID ${id}: ${error.message}`);
        res.status(400).send(error);
    }
});







sslServer.listen(port, () => {
    console.log(`Order service listening at http://localhost:${port}`)
});