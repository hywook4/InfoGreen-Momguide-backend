const express = require('express');
const router = express.Router();

router.use('/', require('./product'));

module.exports = router;