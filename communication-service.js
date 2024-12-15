const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const port = 3007;
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

const Communication = sequelize.define('Communication', {
    communication_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    ticket_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    message: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'communications',
    timestamps: false
});

sequelize.sync({ force: false })
    .then(() => {
        console.log('Database & tables created!');
    })
    .catch(error => {
        console.error('Unable to connect to the database:', error);
    });


app.post('/addcomms', async (req, res) => {
    const comObj = ({
        ticket_id: req.body.ticket_id,
        user_id: req.body.user_id,
        message: req.body.message
    })
    //json data
    // {
    //     "ticket_id": 1,
    //     "user_id": 1,
    //     "message": "Hello"
    // }

    //check user id if exists
    //check ticket id if exists
    //check if ticket is open
    //check if user_id is equal to support_id or user_id

    const user = await axios.get(`http://localhost:3001/users/${comObj.user_id}`);
    const ticket = await axios.get(`http://localhost:3006/tickets/${comObj.ticket_id}`);
    if(!ticket.data){
        console.log("ticket data", ticket.data);
        res.status(404).send('Ticket not found');
    }
    if(!user.data){
        console.log("user data", user.data);
        res.status(404).send('User not found');
    }
    if(ticket.data.status != 'open'){
        res.status(400).send('Ticket is closed');
    }
    if(user.data.user_id != ticket.data.user_id && user.data.user_id != ticket.data.support_id){
        res.status(400).send('User not authorized');
    }
    try{
        const comm = await Communication.create(comObj);
        res.status(200).json(comm);
    } catch (error){
        res.status(400).send('Error');
    }
});


//get communications by tickets
app.get('/comms/:ticket_id', async (req, res) => {
    const ticket_id = req.params.ticket_id;
    try {
        const comms = await Communication.findAll({ where: { ticket_id: ticket_id } });
        return res.status(200).json(comms);
    } catch (error) {
        return res.status(400).send(error);
    }
});

app.get('/comms', async (req, res) => {
    try {
        const comms = await Communication.findAll();
        return res.status(200).json(comms);
    } catch (error) {
        return res.status(400).send(error);
    }
});

app.get('/comms/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const comm = await Communication.findByPk(id);
        return res.status(200).json(comm);
    } catch (error) {
        return res.status(400).send(error);
    }
});

app.put('/comms/:id', async (req, res) => {
    const id = req.params.id;
    const message = req.body.message;

    //json data
    // {
    //     "message": "Hello"
    // }


    try {
        const comm = await Communication.findByPk(id);
        comm.message = message;
        await comm.save();
        return res.status(200).json(comm);
    } catch (error) {
        return res.status(400).send(error);
    }
});

app.delete('/comms/:id', async (req, res) => {
    const id = req.params.id;

    try {
        const comm = await Communication.findByPk(id);
        await comm.destroy();
        return res.status(200).send('Communication deleted');
    } catch (error) {
        return res.status(400).send(error);
    }
});







app.listen(port, () => {
    console.log(`Order service listening at http://localhost:${port}`)
});