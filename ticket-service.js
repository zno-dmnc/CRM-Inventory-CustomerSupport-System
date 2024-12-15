const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const port = 3006;
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

const Ticket = sequelize.define('Ticket', {
    ticket_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    support_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    subject: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.STRING,
        allowNull: false
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false
    },
    priority: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'tickets',
    timestamps: false
});

sequelize.sync({ force: false })
    .then(() => {
        console.log('Database & tables created!');
    })
    .catch(error => {'Unable to connect to the database:', error});



app.post('/createrequest', async (req, res) => {
    const requestObj = ({
        user_id: req.body.user_id,
        support_id: null,
        subject: req.body.subject,
        description: req.body.description,
        status: "pending",
        priority: "tbd"
    })
    //json data
    // {
    //     "user_id": 4,
    //   "support_id": null,
    //     "subject": "subject1",
    //     "description": "description1",
    //     "status": "pending",
    //     "priority": "tbd"
    // }
    //check if user exists
    const user = await axios.get(`http://localhost:3001/users/${requestObj.user_id}`)
    if (!user) {
        return res.status(400).json({ error: 'User not found' });
    }
    //check user_type
    if (user.data.user_type !== 'customer') {
        return res.status(400).json({ error: 'Only customers can request tickets' });
    }

    try {
        const ticket = await Ticket.create(requestObj);
        res.status(200).json(ticket);
    } catch (error) {
        res.status(400).json(error);
    }
});

app.get('/tickets', async (req, res) => {
    try {
        const tickets = await Ticket.findAll();
        return res.status(200).json(tickets);
    } catch (error) {
        return res.status(400).json(error);
    }
});

app.get('/tickets/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const ticket = await Ticket.findByPk(id);
        return res.status(200).json(ticket);
    } catch (error) {
        return res.status(400).json(error);
    }
});



app.put('/createTicket/:id', async (req, res) => {
    const id = req.params.id;
    //json data
    //creating ticket should only change the status to open
    //set the priority based on subject and description
    //input support id
    //only admin or support can create ticket
    // {
    //     "user_id":4 ,
    //      "support_id": 3,
    //     "subject": "subject1",
    //     "description": "description1",
    //     "status": "open",
    //     "priority": "medium"
    // }

    try {

        const getticket = await Ticket.findByPk(id);
        if (!getticket) {
            return res.status(400).json({ error: 'Ticket not found' });
        }
        if (getticket.status !== 'pending') {
            return res.status(400).json({ error: 'Ticket already created' });
        }
        const ticketObj = ({
            user_id: req.body.user_id,
            support_id: req.body.support_id,
            subject: req.body.subject,
            description: req.body.description,
            status: 'open',
            priority: 'medium'
        });





        const ticket = await Ticket.create(ticketObj);
        res.status(200).json(ticket);
    } catch (error) {
        res.status(400).json(error);
    }
});

app.put('/closeticket/:id', async (req, res) => {
    const id = req.params.id;

    try {
        const ticket = await Ticket.findByPk(id);
        if (ticket) {
            ticket.status ="closed";
            await ticket.save();
            return res.status(200).json(ticket);
        } else {
            return res.status(400).send('Ticket not found');
        }
    } catch (error) {
        return res.status(400).send(error);
    }
});

app.put('/updateticket/:id', async (req, res) => {
    const id = req.params.id;
    //json data
    // {
    //     "user_id":4 ,
    //      "support_id": 3,
    //     "subject": "subject1",
    //     "description": "description1",
    //     "status": "open",
    //     "priority": "medium"
    // }

    try {
        const ticket = await Ticket.findByPk(id);
        if (ticket) {
            ticket.user_id = req.body.user_id;
            ticket.support_id = req.body.support_id;
            ticket.subject = req.body.subject;
            ticket.description = req.body.description;
            ticket.status = req.body.status;
            ticket.priority = req.body.priority;

            await ticket.save();
            return res.status(200).json(ticket);
        } else {
            return res.status(400).send('Ticket not found');
        }
    } catch (error) {
        return res.status(400).send(error);
    }
});

app.delete('/deleteticket/:id', async (req, res) => {
    const id = req.params.id;

    try {
        const ticket = await Ticket.findByPk(id);
        if (ticket) {
            await ticket.destroy();
            return res.status(200).send('Ticket deleted');
        } else {
            return res.status(400).send('Ticket not found');
        }
    } catch (error) {
        return res.status(400).send(error);
    }
});













app.listen(port, () => {
    console.log(`Order service listening at http://localhost:${port}`)
});