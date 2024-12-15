const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const port = 3002;
//const axios = require('axios');

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


app.post('/addproduct', async (req, res) => {
    const prodObj = ({
        name: req.body.name,
        description: req.body.description,
        price: req.body.price
    })
    //json data
    // {
    //     "name": "product1",
    //     "description": "product1 description",
    //     "price": 100
    // }

    try {
        const product = await Product.create(prodObj);
        res.status(200).json(product);
    } catch (error) {
        res.status(400).json(error);
    }
});

app.get('/products', async (req, res) => {
    try {
        const products = await Product.findAll();
        res.status(200).json(products);
    } catch (error) {
        res.status(400).json(error);
    }
});

app.get('/products/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const product = await Product.findByPk(id);
        res.status(200).json(product);
    } catch (error) {
        console.log('error getting product');
        res.status(400).json(error);
    }
});

app.put('/products/:id', async (req, res) => {
    const id = req.params.id;
    const prodObj = ({
        name: req.body.name,
        description: req.body.description,
        price: req.body.price
    });

    //json data
    // {
    //     "name": "product3",
    //     "description": "product3 description",
    //     "price": 1200
    // }

    try {
        const product = await Product.findByPk(id);
        if(product) {
            product.name = prodObj.name;
            product.description = prodObj.description;
            product.price = prodObj.price;
            
            await product.save();
            res.status(200).json(product);
        } else {
            res.status(400).send('Product not found');
        }
        
    } catch (error) {
        res.status(400).json(error);
    }
});

app.delete('/products/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const product = await Product.findByPk(id);
        if(product) {
            await product.destroy();
            res.status(200).send('Product deleted');
        } else {
            res.status(400).send('Product not found');
        }
    } catch (error) {
        res.status(400).json(error);
    }
});






app.listen(port, () => {
    console.log(`Product service listening at http://localhost:${port}`);
});