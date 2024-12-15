const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const port = 3003;
const axios = require('axios');

const app = express();
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


app.post('/addorder', async (req, res) => {
    const orderObj = ({
        supplier_id: req.body.supplier_id,
        product_id: req.body.product_id,
        order_quantity: req.body.order_quantity,
    })
    //json data
    // {
    //     "supplier_id": 1,
    //     "product_id": 1,
    //     "order_quantity": 100
    // }
    console.log(orderObj);
    try{
        const product = await axios.get(`http://localhost:3002/products/${orderObj.product_id}`);
        if (!product.data) {
            res.status(400).json({ message: 'Product not found' });
        }
        const user = await axios.get(`http://localhost:3001/users/${orderObj.supplier_id}`);
        if (!user.data) {
            res.status(400).json({ message: 'Supplier not found' });
        }
        const addinventory = await axios.post('http://localhost:3004/addinventory', {
            product_id: orderObj.product_id,
            quantity: orderObj.order_quantity
        });

        if(addinventory.status === 200){
            const order = await Order.create(orderObj);
            res.status(200).json({order: order, updatedInventory: addinventory.data});
        } else {
            res.status(400).json({ message: 'Inventory not added' });
        }
    } catch (error) {
        res.status(400).json({message: 'Error creating order'});
    }

});

app.get('/orders', async (req, res) => {
    try {
        const orders = await Order.findAll();
        return res.status(200).json(orders);
    } catch (error) {
        return res.status(400).send(error);
    }
});

app.get('/orders/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const order = await Order.findByPk(id);
        const product = await axios.get(`http://localhost:3002/products/${order.product_id}`);
        const supplier = await axios.get(`http://localhost:3001/users/${order.supplier_id}`);
        order.dataValues.product = product.data;
        order.dataValues.supplier = supplier.data;
        return res.status(200).json({order: order.dataValues});
    } catch (error) {
        return res.status(400).send(error)
    }
});

app.put('/orders/:id', async (req, res) => {
    const id = req.params.id;
    const orderObj = ({
        supplier_id: req.body.supplier_id,
        product_id: req.body.product_id,
        order_quantity: req.body.order_quantity
    });
    //json data
    // {
    //     "supplier_id": 1,
    //     "product_id": 1,
    //     "order_quantity": 100
    // }
    try {
        const supplier = await axios.get(`http://localhost:3001/users/${orderObj.supplier_id}`);
        if (!supplier.data) {
            return res.status(400).json({ message: 'Supplier not found' });
        }
        const product = await axios.get(`http://localhost:3002/products/${orderObj.product_id}`);
        if (!product.data) {
            return res.status(400).json({ message: 'Product not found' });
        }
        const order = await Order.findByPk(id);
        if(order) {
            order.supplier_id = orderObj.supplier_id;
            order.product_id = orderObj.product_id;
            order.order_quantity = orderObj.order_quantity;
            await order.save();
            return res.status(200).json(order);
        } else {
            return res.status(400).send('Order not found');
        }
    } catch (error) {
        return res.status(400).send(error);
    }
});

app.delete('/orders/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const order = await Order.findByPk(id);
        if (order) {
            await order.destroy();
            return res.status(200).send('Order deleted');
        } else {
            return res.status(400).send('Order not found');
        }
    } catch (error) {
        return res.status(400).send(error);
    }
});







app.listen(port, () => {
    console.log(`Order service listening at http://localhost:${port}`)
});