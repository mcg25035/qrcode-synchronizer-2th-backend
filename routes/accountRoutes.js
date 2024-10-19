const express = require('express');
const Account = require('../models/Account');
const router = express.Router();

// Create a new account
router.post('/', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).send('Username and password are required.');
    }
    try {
        const newAccount = new Account({ username, password });
        await newAccount.save();
        return res.status(201).json(newAccount);
    } catch (err) {
        return res.status(500).send('Server error.');
    }
});

// Log in an account
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).send('Username and password are required.');
    }
    try {
        const account = await Account.findOne({ username, password });
        if (!account) {
            return res.status(401).send('Invalid credentials.');
        }
        req.session.accountId = account._id;
        return res.status(200).json(account);
    } catch (err) {
        return res.status(500).send('Server error.');
    }
});

// Log out an account
router.post('/logout', (req, res) => {
    if (!req.session.accountId) {
        return res.status(400).send('No session to log out from.');
    }
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Failed to log out.');
        }
        return res.status(200).send('Logged out successfully.');
    });
});

router.get('/me', async (req, res) => {
    if (!req.session.accountId) {
        return res.status(401).send('未登入');
    }
    try {
        const account = await Account.findById(req.session.accountId).select('-password');
        if (!account) {
            return res.status(404).send('用戶不存在');
        }
        return res.status(200).json(account);
    } catch (err) {
        return res.status(500).send('伺服器錯誤');
    }
});

module.exports = router;
