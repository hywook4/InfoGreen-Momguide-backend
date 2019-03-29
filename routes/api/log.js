const express = require("express");
const router = express.Router();
const Sequelize = require('sequelize');

const db = require("../../models/index");
const util = require("./util");


/*
    > 로그 post api. 그냥 보는대로 로그 남김 ㅇ
*/

router.post('/event', async (req, res)=>{
    const log = await db.LogEvent.create({
        nickName: req.body.nickName,
        eventId: req.body.eventId,
        title: req.body.title
    }).catch(Sequelize.ValidationError, (err) => {
        if(err){
            res.json({
                error: 'log collecting error'
            });
            return;
        } else{
            res.json({
                success: 'success'
            })
        }
    });
})

router.post('/tip', async (req, res)=>{
    console.log(req.body);
    const log = await db.LogTip.create({
        nickName: req.body.nickName,
        tipId: req.body.eventId,
        title: req.body.title
    }).catch(Sequelize.ValidationError, (err) => {
        if(err){
            console.log(err);
            res.json({
                error: 'log collecting error'
            });
            return;
        } else{
            res.json({
                success: 'success'
            })
        }
    });
})

router.post('/product', async (req, res)=>{
    console.log(req.body);
    const log = await db.LogProduct.create({
        nickName: req.body.nickName,
        productId: req.body.productId,
        category: req.body.category,
        subCategory: req.body.subCategory,
        name: req.body.name,
        brand: req.body.brand
    }).catch(Sequelize.ValidationError, (err) => {
        if(err){
            console.log(err);
            res.json({
                error: 'log collecting error'
            });
            return;
        } else{
            res.json({
                success: 'success'
            })
        }
    });
})

router.post('/price', async (req, res)=>{
    console.log(req.body);
    const log = await db.LogPrice.create({
        nickName: req.body.nickName,
        productId: req.body.productId,
        category: req.body.category,
        subCategory: req.body.subCategory,
        name: req.body.name,
        brand: req.body.brand
    }).catch(Sequelize.ValidationError, (err) => {
        if(err){
            console.log(err);
            res.json({
                error: 'log collecting error'
            });
            return;
        } else{
            res.json({
                success: 'success'
            })
        }
    });
})

router.post('/search', async (req, res)=>{
    console.log(req.body);
    const log = await db.LogSearch.create({
        nickName: req.body.nickName,
        search: req.body.search
    }).catch(Sequelize.ValidationError, (err) => {
        if(err){
            console.log(err);
            res.json({
                error: 'log collecting error'
            });
            return;
        } else{
            res.json({
                success: 'success'
            })
        }
    });
})

module.exports = router;