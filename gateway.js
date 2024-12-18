const express = require('express');
const passport = require('passport');
const session = require('express-session');
const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
require('./auth')

app.use(session({
    secret: 'cats',
    resave: false,
    saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());
// Loading SSL certificate
const sslServer = https.createServer({
    key: fs.readFileSync(path.join(__dirname, 'cert', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'cert', 'cert.pem')),
}, app)

app.get('/', (req, res) => {
    res.send('<a href="/auth/google">Authenticate with Google</a>')
})
app.get('/auth/google',
    passport.authenticate('google', { scope: ['email', 'profile'] })
);

app.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/auth/failure' }),
    (req, res) => {
        // Attach token to response
        if (req.user && req.user.token) {
            res.json({ 
                user: req.user,
                token: req.user.token 
            });
        } else {
            res.status(400).send('No token found.');
        }
    });

app.get('/protected', (req,res) => {
    res.send('Hello!')
})
app.get('/auth/failure', (req, res) => {
    res.status(401).send('Authentication failed.');
});

// Proxy services configuration
const configureProxy = (route, target) => createProxyMiddleware({
    target,
    changeOrigin: true,
    secure: false,
    onError: (err, req, res) => {
        console.error(`Error occurred while proxying to ${route}:`, err.message);
        res.status(500).json({ error: 'Proxy error occurred.' });
    },
});

// Proxy routes
const services = [
    { route: '/login', target: 'https://localhost:3001/login' },
    { route: '/register', target: 'https://localhost:3001/register' },
    { route: '/users', target: 'https://localhost:3001' }, // This will handle /users/* routes
    { route: '/products', target: 'https://localhost:3002' },
    { route: '/orders', target: 'https://localhost:3003' },
    { route: '/inventory', target: 'https://localhost:3004' },
    { route: '/sales', target: 'https://localhost:3005' },
    { route: '/ticket', target: 'https://localhost:3006' },
    { route: '/communication', target: 'https://localhost:3007' },
];

services.forEach(({ route, target }) => {
    app.use(route, configureProxy(route, target));
});

// Start the server
app.listen(3000, () => {
    console.log('Gateway started on port 3000');
});