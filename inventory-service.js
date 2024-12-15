const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const port = 3004;
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


app.post('/addinventory', async (req, res) => {
    const invObj = ({
        product_id: req.body.product_id,
        quantity: req.body.quantity,
    })
    //minimum quantity is 5% of quantity
    invObj.minimum_quantity = invObj.quantity * 0.05;
    //json data
    // {
    //     "product_id": 1,
    //     "quantity": 100
    // }
    try {
        const product = await axios.get(`http://localhost:3002/products/${invObj.product_id}`);
        console.log(product);
        if (!product) {
            return res.status(400).json({ message: 'Product not found' });
        }

        let inventory = await Inventory.findOne({ where: { product_id: invObj.product_id } });

        if (inventory) {
            // Update existing inventory
            inventory.quantity += invObj.quantity;
            inventory.minimum_quantity = inventory.quantity * 0.05;
            await inventory.save();
        } else {
            // Create new inventory
            inventory = await Inventory.create(invObj);
        }
        res.status(200).json(inventory);
    } catch (error) {
        res.status(400).json(error);
    }
});

app.get('/inventory/:id', async (req, res) => {
    id = req.params.id;

    try{
        const inventory = await Inventory.findByPk(id);
        const product = await axios.get(`http://localhost:3002/products/${inventory.product_id}`);
        inventory.dataValues.product = product.data;
        res.status(200).json({inventory: inventory.dataValues});
    } catch (error) {
        console.log('error getting inventory');
        res.status(400).json(error);
    }
});

app.get('/inventory/product/:product_id', async (req, res) => {
    const product_id = req.params.product_id;

    try {
        const inventory = await Inventory.findOne({ where: { product_id } });
        if (!inventory) {
            return res.status(404).json({ message: 'Inventory not found' });
        }
        const product = await axios.get(`http://localhost:3002/products/${inventory.product_id}`);
        inventory.dataValues.product = product.data;
        res.status(200).json({ inventory: inventory.dataValues });
    } catch (error) {
        console.log('error getting inventory');
        res.status(400).json(error);
    }
});

app.get('/inventory', async (req, res) => {
    try {
        const inventory = await Inventory.findAll();
        res.status(200).json(inventory);
    } catch (error) {
        res.status(400).json(error);
    }
});

app.put('/inventory/:id', async (req, res) => {
    const id = req.params.id;
    const invObj = ({
        product_id: req.body.product_id,
        quantity: req.body.quantity,
        minimum_quantity: req.body.minimum_quantity
    });

    //json data
    // {
    //     "product_id": 1,
    //     "quantity": 100,
    //     "minimum_quantity": 5
    // }

    try {
        const inventory = await Inventory.findByPk(id);
        if(inventory) {
            inventory.product_id = invObj.product_id;
            inventory.quantity = invObj.quantity;
            inventory.minimum_quantity = invObj.minimum_quantity;
            
            await inventory.save();
            res.status(200).json(inventory);
        } else {
            res.status(400).send('Inventory not found');
        }
    } catch (error) {
        console.log('error updating inventory');
        res.status(400).json(error);
    }
});

app.delete('/inventory/:id', async (req, res) => {
    const id = req.params.id;

    try {
        const inventory = await Inventory.findByPk(id);
        if(inventory) {
            await inventory.destroy();
            res.status(200).send('Inventory deleted');
        } else {
            res.status(400).send('Inventory not found');
        }
    } catch (error) {
        console.log('error deleting inventory');
        res.status(400).json(error);
    }
});



app.listen(port, () => {
    console.log(`Inventory service listening at http://localhost:${port}`)
});