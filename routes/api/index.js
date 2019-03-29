const express = require('express');
const router = express.Router();

router.use('/product', require('./product'));
router.use('/roadNameAddress', require('./roadNameAddress'));
router.use('/auth', require('./auth'));
router.use('/ask', require('./ask'));
router.use('/tip', require('./tip'));
router.use('/event', require('./event'));
router.use('/review', require('./review'));
router.use('/like', require('./like'));
router.use('/report', require('./report'));
router.use('/alarm', require('./alarm'));
router.use('/main', require('./main'));
router.use('/log', require('./log'));

module.exports = router;