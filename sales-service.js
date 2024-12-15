const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const port = 3005;
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


app.post('/addsale', async (req, res) => {
    const saleObj = ({
        user_id: req.body.user_id,
        product_id: req.body.product_id,
        quantity: req.body.quantity,
    })

    //json data
    // {
    //     "user_id": 1,
    //     "product_id": 1,
    //     "quantity": 100,
    // }

    try{
        const user = await axios.get(`http://localhost:3001/users/${saleObj.user_id}`);
        const getinventory = await axios.get(`http://localhost:3004/inventory/product/${saleObj.product_id}`);
        const inventory = getinventory.data.inventory;
        const product = await axios.get(`http://localhost:3002/products/${saleObj.product_id}`);
        if(!user.data){
            return res.status(404).send('User not found');
        } 
        //check if the quantity is available in the inventory-service
        
        if(!inventory){
            return res.status(404).send('Product not found in inventory');
        }
        if(inventory.quantity < saleObj.quantity){
            return res.status(400).send('Not enough quantity in inventory');
        }
        //decrement the quantity in the inventory-service
        const updateInventory = await axios.put(`http://localhost:3004/inventory/${inventory.inventory_id}`, {
            product_id: inventory.product_id,
            quantity: inventory.quantity - saleObj.quantity,
            minimum_quantity: inventory.minimum_quantity
        });
        //calculate the total price
        const total = product.data.price * saleObj.quantity;
        saleObj.total = total;

        const sale = await Sales.create(saleObj);
        return res.status(200).json(sale);

    } catch (error) {
        console.error(error);
        return res.status(500).send('Internal Server Error');
    }
    
});

app.get('/sales', async (req, res) => {
    try {
        const sales = await Sales.findAll();
        return res.status(200).json(sales);
    } catch (error) {
        return res.status(400).send(error);
    }
});

app.get('/sales/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const sale = await Sales.findByPk(id);
        const product = await axios.get(`http://localhost:3002/products/${sale.product_id}`);
        const user = await axios.get(`http://localhost:3001/users/${sale.user_id}`);
        sale.dataValues.product = product.data;
        sale.dataValues.user = user.data;
        return res.status(200).json({sale: sale.dataValues});
    } catch (error) {
        return res.status(400).send(error)
    }
});

app.put('/sale/:id', async (req, res) => {
    const saleId = req.params.id;
    const newQuantity = req.body.quantity;


    //json data
    // {
    //     "quantity": 200
    // }
    try {
        // Fetch the existing sale record
        const sale = await Sales.findByPk(saleId);
        if (!sale) {
            return res.status(404).send('Sale not found');
        }

        // Fetch the inventory record
        const getinventory = await axios.get(`http://localhost:3004/inventory/product/${sale.product_id}`);
        const inventory = getinventory.data.inventory;
        if (!inventory) {
            return res.status(404).send('Product not found in inventory');
        }

        // Calculate the difference in quantity
        const quantityDifference = newQuantity - sale.quantity;

        // Check if the new quantity is available in the inventory
        if (inventory.quantity < quantityDifference) {
            return res.status(400).send('Not enough quantity in inventory');
        }

        // Update the inventory quantity
        await axios.put(`http://localhost:3004/inventory/${inventory.inventory_id}`, {
            product_id: inventory.product_id,
            quantity: inventory.quantity - quantityDifference,
            minimum_quantity: inventory.minimum_quantity
        });

        // Fetch the product to get the price
        const product = await axios.get(`http://localhost:3002/products/${sale.product_id}`);
        if (!product.data) {
            return res.status(404).send('Product not found');
        }

        // Update the sale record with the new quantity and total price
        sale.quantity = newQuantity;
        sale.total = product.data.price * newQuantity;
        await sale.save();

        return res.status(200).json(sale);
    } catch (error) {
        console.error(error);
        return res.status(500).send('Internal Server Error');
    }
});

app.delete('/sale/:id', async (req, res) => {
    const saleId = req.params.id;

    try {
        // Fetch the existing sale record
        const sale = await Sales.findByPk(saleId);
        if (!sale) {
            return res.status(404).send('Sale not found');
        }

        // Fetch the inventory record
        const getinventory = await axios.get(`http://localhost:3004/inventory/product/${sale.product_id}`);
        const inventory = getinventory.data.inventory;
        if (!inventory) {
            return res.status(404).send('Product not found in inventory');
        }

        // Update the inventory quantity
        await axios.put(`http://localhost:3004/inventory/${inventory.inventory_id}`, {
            product_id: inventory.product_id,
            quantity: inventory.quantity + sale.quantity,
            minimum_quantity: inventory.minimum_quantity
        });

        // Delete the sale record
        await sale.destroy();

        return res.status(200).send('Sale deleted successfully');
    } catch (error) {
        console.error(error);
        return res.status(500).send('Internal Server Error');
    }
});


    






app.listen(port, () => {
    console.log(`Order service listening at http://localhost:${port}`)
});