const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const port = 3001;


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


const User = sequelize.define('User', {
    user_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: false
    },
    address: {
        type: DataTypes.STRING,
        allowNull: false
    },
    user_type: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
}, {
    tableName: 'users',
    timestamps: true
});

sequelize.sync({ force: false })
    .then(() => {
        console.log(`Database & tables created!`);
    })
    .catch(error => {
        console.error('Unable to create tables:', error);
    });



app.get('/users', async (req, res) => {
    try {
        const users = await User.findAll();
        return res.status(200).json(users);
    } catch (error) {
        return res.status(400).send(error);
    }
});

app.get('/users/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const user = await User.findByPk(id);
        return res.status(200).json(user);
    } catch (error) {
        return res.status(400).send(error)
    }
});

app.post('/register', async (req, res) => {
    const userObj = ({
        name: req.body.name,
        phone: req.body.phone,
        address: req.body.address,
        user_type: req.body.user_type,
        email: req.body.email,
        password: req.body.password
    });

    //json data
    // {
    //     "name": "John Doe",
    //     "phone": "1234567890",
    //     "address": "New York",
    //     "user_type": "admin",
    //     "email": "john@gmail.com",
    //     "password": "john123"
    // }

    try {
        const user = await User.create(userObj);
        return res.status(200).json(user);
    } catch (error) {
        res.status(400).send(error);
    }
});

app.post('/login', async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;

    //json data
    // {
    //      "email": "john@gmail.com",
    //      "password": "john123"
    // }



    try {
        const user = await User.findOne({ email: email });
        if (user.password === password) {
            return res.status(200).json(user);
        } else {
            return res.status(400).send('Invalid credentials');
        }
    } catch (error) {
        return res.status(400).send('Invalid credentials');
    }
});


app.put('/users/:id', async (req, res) => {
    const id = req.params.id;

    //json data
    // {
    //     "name": "Luigi Mangione",
    //     "phone": "1234567890",
    //     "address": "New York",
    //     "password": "john123"
    // }

    try {
        const user = await User.findByPk(id);
        if (user) {
            user.name = req.body.name;
            user.phone = req.body.phone;
            user.address = req.body.address;
            user.password = req.body.password;

            await user.save();
            return res.status(200).json(user);
        } else {
            return res.status(400).send('User not found');
        }
    } catch (error) {
        return res.status(400).send(error);
    }
});


app.delete('/users/:id', async (req, res) => {
    const id = req.params.id;

    try {
        const user = await User.findByPk(id);
        if (user) {
            await user.destroy();
            return res.status(200).send('User deleted');
        } else {
            return res.status(400).send('User not found');
        }
    } catch (error) {
        return res.status(400).send(error);
    }
});
















app.listen(port, () => {
    console.log(`User service listening at http://localhost:${port}`);
});
