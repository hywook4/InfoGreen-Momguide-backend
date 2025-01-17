const express = require("express");
const router = express.Router();
const formidable = require("express-formidable");
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

const db = require("../../models/index");
const util = require("./util");
const config = require("../../config/config");

/*
 * 리뷰 불러오기 : GET /api/review?id=1
 */

router.get('/', async (req, res) => {
    if(!req.query.id) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    try {
        const review = await db.ProductReview.findOne({
            where: {
                index: req.query.id
            }
        });

        let product;
        if (review.living_index) {
            product = await db.sequelize.query(`SELECT * FROM living WHERE \`index\`=${review.living_index}`);
        } else {
            product = await db.sequelize.query(`SELECT * FROM cosmetic WHERE \`index\`=${review.cosmetic_index}`);
        }

        const reviewImages = await review.getProductReviewImages();
        const additionalReviews = await review.getProductAdditionalReviews();
        res.json({
            review: review,
            images: reviewImages,
            additionalReview: additionalReviews,
            product: product[0][0]
        });
    } catch(e) {
        console.log(e);
        res.status(400).json({
            error: "invalid request"
        });
    }
});

/*
 * 개인 리뷰 목록 불러오기 : GET /api/review/member/list?page=1&category=living
 * AUTHORIZATION NEEDED
 */

router.get('/member/list', async (req, res) => {
    if(!req.query.category || !(req.query.category === 'living' || req.query.category === 'cosmetic')) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    try {
        let token = req.headers['authorization'];
        token = await util.decodeToken(token, res);

        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const member = await db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        });

        if(!member) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const page = req.query.page ? req.query.page : 1;
        const pageSize = 6;

        let reviews = await member.getProductReviews();
        reviews = reviews.filter((review) => (req.query.category === 'living' ? review.dataValues.living_index !== null : review.dataValues.cosmetic_index !== null));
        const totalLength = reviews.length;
        reviews = (reviews.slice((page-1) * pageSize, page * pageSize));
        const result = [];

        for(const i in reviews) {
            const review = reviews[i];
            const additionalReviews = await review.getProductAdditionalReviews();

            const product = (req.query.category === 'living') ?
                await db.LivingDB.findOne({
                    where: {
                        index: review.dataValues.living_index
                    }
                }) :
                await db.CosmeticDB.findOne({
                    where : {
                        index: review.dataValues.cosmetic_index
                    }
                });

            result.push({
                review: review,
                recentDate: (additionalReviews.length ? additionalReviews[additionalReviews.length - 1].date : null),
                product: product
            });
        }

        res.json({
            reviews: result,
            totalPages: Math.floor((totalLength + pageSize - 1) / pageSize)
        });
    } catch(e) {
        console.log(e);
        res.status(400).json({
            error: "invalid request"
        });
    }
});

/*
 * 상품 리뷰 목록 불러오기 : GET /api/review/product/list?category=living&id=1&page=1&sorting=late
 * sorting : late or like or rating
 * AUTHORIZATION NEEDED
 */

router.get('/product/list', async (req, res) => {
    if(!req.query.category || !(req.query.category === 'living' || req.query.category === 'cosmetic') ||
        !req.query.id || isNaN(Number(req.query.id))) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    try {
        let token = req.headers['authorization'];
        token = await util.decodeToken(token, res);

        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const member = await db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        });

        if(!member) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const product = (req.query.category === 'living') ?
            await db.LivingDB.findOne({
                where: {
                    index: Number(req.query.id)
                }
            }) :
            await db.CosmeticDB.findOne({
                where : {
                    index: Number(req.query.id)
                }
            });
        const page = req.query.page ? (Number(req.query.page) > 0 ? Number(req.query.page) : 1) : 1;
        const pageSize = 6;

        const sorting = (req.query.sorting && (req.query.sorting === 'late' || req.query.sorting === 'like' || req.query.sorting === 'rating')) ?
            req.query.sorting : 'late';
        let reviews = await product.getProductReviews();

        if(sorting === 'late') {
            reviews.reverse();
        } else if(sorting === 'like') {
            for(const i in reviews) {
                const likeList = await reviews[i].getLikeOrHates();
                reviews[i].dataValues.likeCount = likeList.length;
            }
            reviews.sort((a, b) => {
                return a.dataValues.likeCount > b.dataValues.likeCount ? -1
                    : (a.dataValues.likeCount < b.dataValues.likeCount ? 1 : 0)
            });
            console.log(reviews);
        } else {
            reviews.sort((a, b) => {
                if(a.dataValues.rating > b.dataValues.rating)
                    return -1;
                if(a.dataValues.rating < b.dataValues.rating)
                    return 1;
                return 0;
            });
        }

        const nextPageExist = (reviews.length >= page * pageSize);
        const totalPages = Math.ceil(reviews.length / pageSize);
        reviews = reviews.slice((page-1) * pageSize, page * pageSize);

        const result = {
            nextPageExist: nextPageExist,
            totalPages: totalPages,
            reviews: []
        };

        for(const i in reviews) {
            const review = reviews[i];

            const imagesPromise = db.ProductReviewImage.findAll({
                where: {
                    'product_review_index': review.index
                }
            });

            const additionalReviewsPromise = db.ProductAdditionalReview.findAll({
                where: {
                    'product_review_index': review.index
                }
            });

            const likePromise = db.sequelize.query(
                `SELECT * FROM like_or_hate WHERE member_info_index=${member.index} AND product_review_index=${review.index};`,
                { type: db.sequelize.QueryTypes.SELECT });

            const reviewOwner = (await db.sequelize.query(`SELECT * FROM member_info WHERE \`index\`=${review.member_info_index}`))[0][0];
            const like = await likePromise;
            const images = await imagesPromise;
            const additionalReviews = await additionalReviewsPromise;

            result.reviews.push({
                reviewOwner: reviewOwner,
                review: review,
                images: images,
                additionalReviews: additionalReviews,
                like: like.length > 0
            });
        }
        res.json(result);
    } catch(e) {
        console.log(e);
        res.status(400).json({
            error: "invalid request"
        });
    }
});

/*
 * 상품 리뷰 목록 개수 불러오기 : GET /api/review/product/list/count?category=living&id=1
 * AUTHORIZATION NEEDED
 */

router.get('/product/list/count', async (req, res) => {
    if(!req.query.category || !(req.query.category === 'living' || req.query.category === 'cosmetic') ||
        !req.query.id || isNaN(Number(req.query.id))) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    try {
        const product = (req.query.category === 'living') ?
            await db.LivingDB.findOne({
                where: {
                    index: Number(req.query.id)
                }
            }) :
            await db.CosmeticDB.findOne({
                where : {
                    index: Number(req.query.id)
                }
            });

        let reviews = await product.getProductReviews();

        res.json({
            count: reviews.length
        });
    } catch(e) {
        console.log(e);
        res.status(400).json({
            error: "invalid request"
        });
    }
});

/*
 * 상품에 대해 리뷰를 작성한 여부 불러오기 : GET /api/review/status?category=living&id=1
 * AUTHORIZATION NEEDED
 */

router.get('/status', async (req, res) => {
    const category = req.query.category;
    if(!category || !(category === 'living' || category === 'cosmetic') ||
        !req.query.id || isNaN(Number(req.query.id))) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }
    const id = Number(req.query.id);

    try {
        let token = req.headers['authorization'];
        token = await util.decodeToken(token, res);

        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const member = await db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        });

        if(!member) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const reviewExist = await db.sequelize.query(
            `SELECT * FROM product_review WHERE (member_info_index=${member.index} AND ${category}_index=${id});`,
            { type: db.sequelize.QueryTypes.SELECT });

        if(reviewExist.length) {
            res.json({
                exist: true
            });
        } else {
            res.json({
                exist: false
            });
        }
    } catch(e) {
        console.log(e);
        res.status(400).json({
            error: "invalid request"
        });
    }
});

/*
 * 상품에 대한 전체 정보 요약 불러오기 : GET /api/review/summary?category=living&id=1
 * sorting : late or like or rating
 */

router.get('/summary', async (req, res) => {
    const category = req.query.category;
    const id = req.query.id;

    if(!category || !(category === 'living' || category === 'cosmetic') ||
        !id || isNaN(Number(id))) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    try {
        const product = category === 'living' ?
            await db.LivingDB.findOne({
                where: {
                    index: id
                }
            }) :
            await db.CosmeticDB.findOne({
                where: {
                    index: id
                }
            });

        if(!product) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const reviews = await product.getProductReviews();
        if(reviews.length === 0) {
            res.json({
                rating: 0,
                functionalityCount: [0, 0, 0],
                nonIrritatingCount: [0, 0, 0],
                sentCount: [0, 0, 0],
                costEffectivenessCount: [0, 0, 0],
                images: []
            });
            return;
        }
        const getImagesQuery = `SELECT * FROM product_review_image WHERE` +
            reviews.map((review, i) => {
                if(i === 0)
                    return ` product_review_index=${review.index}`;
                else
                    return ` OR product_review_index=${review.index}`;
            }).join('') + ';';
        let images = reviews.length ? (await db.sequelize.query(getImagesQuery))[0] : [];
        if(images.length !== 0) {
            images = images.sort((a, b) => a.index > b.index ? -1 : 1).slice(0, 10);
        }

        const countFunction = (array, key, value) => {
            return array.filter((item) => item[key] === value).length;
        };

        res.json({
            rating: product.rateSum / product.rateCount,
            functionalityCount: [1, 2, 3].map((num) => countFunction(reviews, 'functionality', num)),
            nonIrritatingCount: [1, 2, 3].map((num) => countFunction(reviews, 'nonIrritating', num)),
            sentCount: [1, 2, 3].map((num) => countFunction(reviews, 'sent', num)),
            costEffectivenessCount: [1, 2, 3].map((num) => countFunction(reviews, 'costEffectiveness', num)),
            images: images
        });
    } catch(e) {
        console.log(e);
        res.status(400).json({
            error: "invalid request"
        });
    }
});

/*
 * 리뷰에 해당하는 상품 불러오기: GET /api/review/product?reviewId=1
 */

router.get('/product', async (req, res) => {
    if(!req.query.reviewId || isNaN(Number(req.query.reviewId))) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    try {
        const review = await db.ProductReview.findOne({
            where: {
                index: req.query.reviewId
            }
        });

        let product;
        if (review.living_index) {
            product = await db.sequelize.query(`SELECT * FROM living WHERE index=${review.index}`);
        } else {
            product = await db.sequelize.query(`SELECT * FROM cosmetic WHERE index=${review.index}`);
        }
        res.json(product[0][0]);
    } catch(e) {
        res.status(400).json({
            error: "invalid request"
        });
    }
});

/*
 * 베스트 리뷰 불러오기 : GET /api/review/best?category=living&id=1
 * AUTHORIZATION OPTION
 */

router.get('/best', async (req, res) => {
    const category = req.query.category;
    const id = req.query.id;

    if(!category || !(category === 'living' || category === 'cosmetic') ||
        !id || isNaN(Number(id))) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    try {
        let token = req.headers['authorization'];
        token = token ? (await util.decodeToken(token, res)) : null;

        const member = token ? (await db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        })) : null;

        const product = category === 'living' ?
            await db.LivingDB.findOne({
                where: {
                    index: id
                }
            }) :
            await db.CosmeticDB.findOne({
                where: {
                    index: id
                }
            });

        const reviews = await product.getProductReviews();

        if (!reviews || !product) {
            res.status(424).json({
                error: "find error"
            });
            return;
        }
        if(reviews.length === 0) {
            res.json({});
            return;
        }

        for (let i = 0; i < reviews.length; ++i) {
            const likeList = await reviews[i].getLikeOrHates();
            reviews[i].dataValues.likeCount = likeList.length;
        }
        reviews.sort((review1, review2) => {
            return review1.dataValues.likeCount > review2.dataValues.likeCount ? -1
                : (review1.dataValues.likeCount < review2.dataValues.likeCount ? 1 : 0);
        });

        const review = reviews[0];
        const imagesPromise = db.ProductReviewImage.findAll({
            where: {
                'product_review_index': review.index
            }
        });

        const additionalReviewsPromise = db.ProductAdditionalReview.findAll({
            where: {
                'product_review_index': review.index
            }
        });

        const reviewOwner = (await db.sequelize.query(`SELECT * FROM member_info WHERE \`index\`=${review.member_info_index}`))[0][0];
        const images = await imagesPromise;
        const additionalReviews = await additionalReviewsPromise;

        const like = member ? (await db.sequelize.query(
            `SELECT * FROM like_or_hate WHERE member_info_index=${member.index} AND product_review_index=${review.index};`,
            { type: db.sequelize.QueryTypes.SELECT })).length > 0 : false;

        res.json({
            reviewOwner: reviewOwner,
            review: review,
            images: images,
            additionalReviews: additionalReviews,
            like: like
        });
    } catch(e) {
        console.log(e);
        res.status(400).json({
            error: "invalid request"
        });
    }
});

/*
 * 리뷰 등록하기 : POST /api/review
 * AUTHORIZATION NEEDED
 * BODY SAMPLE (FORM-DATA) : {
 *  "category": "living",
 *  "productId": "1",
 *  "rating": "5",        (1~5)
 *  "useMonth": "3",      (1~12)
 *  "content": "text",
 *  "functionality": "1", (1~3)
 *  "nonIrritating": "2", (1~3)
 *  "sent": "3",          (1~3)
 *  "costEffectiveness": "1", (1~3)
 *  "images": (binary)  (선택사항)
 * }
 */

router.post('/', formidable({multiples: true}), async (req, res) => {
    if((req.fields.category !== 'living' && req.fields.category !== 'cosmetic') ||
            isNaN(Number(req.fields.productId)) ||
            isNaN(Number(req.fields.rating))|| !(req.fields.rating >= 1 && req.fields.rating <= 5) ||
            isNaN(Number(req.fields.useMonth)) || !(req.fields.useMonth >= 1 && req.fields.useMonth <= 12) ||
            isNaN(Number(req.fields.functionality)) || !(req.fields.functionality >= 1 && req.fields.functionality <= 3) ||
            isNaN(Number(req.fields.nonIrritating)) || !(req.fields.nonIrritating >= 1 && req.fields.nonIrritating <= 3) ||
            isNaN(Number(req.fields.sent)) || !(req.fields.sent >= 1 && req.fields.sent <= 3) ||
            isNaN(Number(req.fields.costEffectiveness)) || !(req.fields.costEffectiveness >= 1 && req.fields.costEffectiveness <= 3)) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    const moment = require('moment');
    const reviewObject = {
        rating: Number(req.fields.rating),
        baseDate: moment().subtract(Number(req.fields.useMonth), 'months'),
        content: req.fields.content ? req.fields.content : '',
        functionality: Number(req.fields.functionality),
        nonIrritating: Number(req.fields.nonIrritating),
        sent: Number(req.fields.sent),
        costEffectiveness: Number(req.fields.costEffectiveness),
    };

    try {
        let token = req.headers['authorization'];
        token = await util.decodeToken(token, res);

        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const member = await db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        });

        let product = null;
        if(req.fields.category === 'living') {
            product = await db.LivingDB.findOne({
                where: {
                    index: req.fields.productId
                }
            });
        } else {
            product = await db.CosmeticDB.findOne({
                where: {
                    index: req.fields.productId
                }
            });
        }
        
        if(!member || !product) {
            res.status(400).json({
                error: 'invalid request'
            });
            return;
        }
        
        const reviewExist = await db.sequelize.query(
            `SELECT * FROM product_review WHERE (member_info_index=${member.index} AND ${req.fields.category}_index=${product.index});`,
            { type: db.sequelize.QueryTypes.SELECT });
        if(reviewExist.length) {
            res.status(400).json({
                error: 'invalid request'
            });
            return;
        }

        const review = await db.ProductReview.create(reviewObject);
        member.addProductReview(review);
        product.addProductReview(review);
        product.rateCount += 1;
        product.rateSum += reviewObject.rating;
        await product.save();

        let images = req.files.images;
        if(typeof images === 'object' && !images.length) {
            images = [images];
        }
        if(images && images.length) {
            const imageObjectArray = [];

            for (let i = 0; i < images.length; i++) {
                const image = images[i];

                const params = {
                    Bucket: config.s3Bucket,
                    Key: `review-images/${review.index}-${i}${util.getExtension(image.name)}`,
                    ACL: 'public-read',
                    Body: require('fs').createReadStream(image.path)
                };

                await s3.putObject(params).promise();
                imageObjectArray.push({
                    url: `https://s3.ap-northeast-2.amazonaws.com/infogreenmomguide/review-images/${review.index}-${i}${util.getExtension(image.name)}`
                });
            }
            const imageObjects = await db.ProductReviewImage.bulkCreate(imageObjectArray);
            review.setProductReviewImages(imageObjects);
        }

        res.json(review);
    } catch (e) {
        console.log(e);
        res.status(500).json({
            error: "Internal Server Error"
        });
    }
});

/*
 * 리뷰 좋아요 : POST /api/review/like
 * AUTHORIZATION NEEDED
 * BODY SAMPLE: {
 *  "reviewId": 1,
 * }
 */

router.post('/like', async (req, res) => {
    if(!req.body.reviewId || isNaN(Number(req.body.reviewId))) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    try {
        let token = req.headers['authorization'];
        token = await util.decodeToken(token, res);

        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const memberPromise = db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        });

        const reviewPromise = db.ProductReview.findOne({
            where: {
                index: Number(req.body.reviewId)
            }
        });

        const member = await memberPromise;
        const review = await reviewPromise;

        if(!member || !review) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const like = await db.sequelize.query(
            `SELECT * FROM like_or_hate WHERE member_info_index=${member.index} AND product_review_index=${req.body.reviewId};`,
            { type: db.sequelize.QueryTypes.SELECT });

        if(like.length) {
            res.json({
                like: false
            })
        } else {
            const like = await db.LikeOrHate.create({
                assessment: true
            });
            member.addLikeOrHate(like);
            review.addLikeOrHate(like);
            res.json({
                like: true
            });
        }
    } catch(e) {
        console.log(e);
        res.status(400).json({
            error: "invalid request"
        });
    }
});

/*
 * 리뷰 신고하기 : POST /api/review/report
 * AUTHORIZATION NEEDED
 * BODY SAMPLE {
 *  "reviewId": 1
 *  "reason": "abusing"
 *  "reasonSpec": "" (OPTIONAL)
 * }
 */

router.post('/report', async (req, res) => {
    if(!req.body.reviewId || isNaN(Number(req.body.reviewId)) || !req.body.reason || typeof req.body.reason !== 'string') {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    try {
        let token = req.headers['authorization'];
        token = await util.decodeToken(token, res);

        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const memberPromise = db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        });

        const reviewPromise = db.ProductReview.findOne({
            where: {
                index: Number(req.body.reviewId)
            }
        });

        const member = await memberPromise;
        const review = await reviewPromise;

        if(!member || !review) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const reportQuery = {
            reason: req.body.reason
        };

        if(req.body.reasonSpec && typeof req.body.reasonSpec === 'string')
            reportQuery['reasonSpec'] = req.body.reasonSpec;

        const report = await db.Report.create(reportQuery);
        member.addReport(report);
        review.addReport(report);

        res.json(report);
    } catch(e) {
        console.log(e);
        res.status(400).json({
            error: "invalid request"
        });
    }
});

/*
 * 리뷰 수정하기 : PUT /api/review
 * AUTHORIZATION NEEDED
 * BODY SAMPLE (FORM-DATA) {
 *  "reviewId": 1,
 *  "category": "living",
 *  "productId": 1,
 *  "rating": 5
 *  "content": "text",
 *  "functionality": 1,
 *  "nonIrritating": 2,
 *  "sent": 3,
 *  "costEffectiveness": 1,
 *  "images": (binary)
 * }
 */

router.put('/', formidable({multiples: true}), async (req, res) => {
    if(isNaN(Number(req.fields.reviewId)) ||
        isNaN(Number(req.fields.rating))|| !(req.fields.rating >= 1 && req.fields.rating <= 5) ||
        isNaN(Number(req.fields.functionality)) || !(req.fields.functionality >= 1 && req.fields.functionality <= 3) ||
        isNaN(Number(req.fields.nonIrritating)) || !(req.fields.nonIrritating >= 1 && req.fields.nonIrritating <= 3) ||
        isNaN(Number(req.fields.sent)) || !(req.fields.sent >= 1 && req.fields.sent <= 3) ||
        isNaN(Number(req.fields.costEffectiveness)) || !(req.fields.costEffectiveness >= 1 && req.fields.costEffectiveness <= 3)) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    const reviewModifyObject = {
        rating: Number(req.fields.rating),
        content: req.fields.content ? req.fields.content : '',
        functionality: Number(req.fields.functionality),
        nonIrritating: Number(req.fields.nonIrritating),
        sent: Number(req.fields.sent),
        costEffectiveness: Number(req.fields.costEffectiveness),
    };

    try {
        let token = req.headers['authorization'];
        token = await util.decodeToken(token, res);

        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const member = await db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        });

        let product = null;
        if(req.fields.category === 'living') {
            product = await db.LivingDB.findOne({
                where: {
                    index: req.fields.productId
                }
            });
        } else {
            product = await db.CosmeticDB.findOne({
                where: {
                    index: req.fields.productId
                }
            });
        }

        if(!member || !product) {
            res.status(400).json({
                error: 'invalid request'
            });
            return;
        }

        const review = await db.ProductReview.findOne({
            where: {
                index: req.fields.reviewId
            }
        });

        if(!review || (review.member_info_index !== member.index)) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        product.ratingSum -= review.rating;
        product.ratingSum += reviewModifyObject.rating;
        await product.save();
        await review.update(reviewModifyObject);

        await db.ProductReviewImage.destroy({where: {product_review_index: review.index}});

        const images = req.files.images;
        if(images) {
            const imageObjectArray = [];

            for (let i = 0; i < images.length; i++) {
                const image = images[i];

                const params = {
                    Bucket: config.s3Bucket,
                    Key: `review-images/${review.index}-${i}${util.getExtension(image.name)}`,
                    ACL: 'public-read',
                    Body: require('fs').createReadStream(image.path)
                };

                await s3.putObject(params).promise();
                imageObjectArray.push({
                    url: `https://s3.ap-northeast-2.amazonaws.com/infogreenmomguide/review-images/${review.index}-${i}${util.getExtension(image.name)}`
                });
            }
            const imageObjects = await db.ProductReviewImage.bulkCreate(imageObjectArray);
            review.setProductReviewImages(imageObjects);
        }

        res.json(review);
    } catch (e) {
        console.log(e);
        res.status(500).json({
            error: "Internal Server Error"
        });
    }
});

/*
 * 리뷰 삭제하기 : DELETE /api/review
 * AUTHORIZATION NEEDED
 * BODY SAMPLE (JSON) {
 *  "reviewId": 1
 * }
 */

router.delete('/', async (req, res) => {
    try {
        let token = req.headers['authorization'];
        token = await util.decodeToken(token, res);

        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const member = await db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        });

        if(!member) {
            res.status(400).json({
                error: 'invalid request'
            });
            return;
        }

        const review = await db.ProductReview.findOne({
            where: {
                index: req.body.reviewId
            }
        });

        if(review.member_info_index !== member.index) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }
        await review.destroy();

        res.json({success: true});
    } catch (e) {
        console.log(e);
        res.status(500).json({
            error: "Internal Server Error"
        });
    }
});

/*
 * 리뷰 좋아요 취소 : DELETE /api/review/like
 * AUTHORIZATION NEEDED
 * BODY SAMPLE: {
 *  "reviewId": 1
 * }
 */

router.delete('/like', async (req, res) => {
    if(!req.body.reviewId || isNaN(Number(req.body.reviewId))) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    try {
        let token = req.headers['authorization'];
        token = await util.decodeToken(token, res);

        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const member = await db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        });

        const review = await db.ProductReview.findOne({
            where: {
                index: Number(req.body.reviewId)
            }
        });

        if(!member || !review) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const like = await db.sequelize.query(
            `SELECT * FROM like_or_hate WHERE member_info_index=${member.index} AND product_review_index=${req.body.reviewId};`,
            { type: db.sequelize.QueryTypes.SELECT });

        if(like.length) {
            await db.LikeOrHate.destroy({
                where: {
                    index: like[0].index
                }
            });
            res.json({
                success: true
            });
        } else {
            res.status(400).json({
                error: 'already like canceled'
            });
        }
    } catch(e) {
        console.log(e);
        res.status(400).json({
            error: "invalid request"
        });
    }
});

/*
 * 추가 리뷰 목록 불러오기 : GET /api/review/addition?reviewId=1
 */

router.get('/addition', async (req, res) => {
    try {
        const reviewId = req.query.reviewId;

        const review = await db.ProductReview.findOne({
            where: {
                index: reviewId
            }
        });

        const reviews = await review.getProductAdditionalReviews();
        res.json(reviews);
    } catch(e) {
        res.status(400).json({
            error: "invalid request"
        });
    }
});

/*
 * 추가 리뷰 추가하기 : POST /api/review/addition
 * AUTHORIZATION NEEDED
 * BODY SAMPlE (JSON) : {
 *  reviewId: 1,
 *  content: 'text',
 *  ended: true
 * }
 */

router.post('/addition', async (req, res) => {
    if(!req.body.reviewId || isNaN(Number(req.body.reviewId)) ||
        !req.body.content) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    try {
        let token = req.headers['authorization'];
        token = await util.decodeToken(token, res);

        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const member = await db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        });

        if(!member) {
            res.status(400).json({
                error: 'invalid request'
            });
            return;
        }

        const review = await db.ProductReview.findOne({
            where: {
                index: req.body.reviewId
            }
        });

        if(review.member_info_index !== member.index) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const reviews = (await review.getProductAdditionalReviews());

        const moment = require('moment');
        if(reviews.length !== 0) {
            console.log(moment(reviews[reviews.length-1].date).diff(moment(), 'days'));
            if(moment().diff(moment(reviews[reviews.length-1].date), 'days') < 28) {
                res.status(400).json({
                    error: "can post after one month"
                });
                return;
            }
            if(reviews[reviews.length-1].ended) {
                console.log(reviews);
                res.status(400).json({
                    error: "already ended review"
                });
                return;
            }
        }
        const additionalReview = await db.ProductAdditionalReview.create({
            date: moment(),
            content: req.body.content,
            ended: req.body.ended
        });

        review.addProductAdditionalReview(additionalReview);
        res.json(additionalReview);
    } catch(e) {
        console.log(e);
        res.status(400).json({
            error: "invalid request"
        });
    }
});

/*
 * 추가 리뷰 수정하기 : PUT /api/review/addition
 * AUTHORIZATION NEEDED
 * BODY SAMPLE (JSON) : {
 *  additionalReviewId: 1,
 *  content: 'text'
 * }
 */

router.put('/addition', async (req, res) => {
    if(!req.body.additionalReviewId || isNaN(Number(req.body.additionalReviewId)) ||
        !req.body.content) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    try {
        let token = req.headers['authorization'];
        token = await util.decodeToken(token, res);

        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const member = await db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        });

        if(!member) {
            res.status(400).json({
                error: 'invalid request'
            });
            return;
        }

        const additionalReview = await db.ProductAdditionalReview.findOne({
            where: {
                index: req.body.additionalReviewId
            }
        });

        if(!additionalReview) {
            res.status(400).json({
                error: 'invalid request'
            });
            return;
        }

        const review = await db.ProductReview.findOne({
            where: {
                index: additionalReview.product_review_index
            }
        });

        if(review.member_info_index !== member.index) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        additionalReview.content = req.body.content;
        additionalReview.save();

        res.json(additionalReview);
    } catch(e) {
        res.status(400).json({
            error: "invalid request"
        });
    }
});

/*
 * 추가 리뷰 삭제하기 : DELETE /api/review/addition
 * AUTHORIZATION NEEDED
 * BODY SAMPLE (JSON) : {
 *  additionalReviewId: 1
 * }
 */

router.delete('/addition', async (req, res) => {
    if(!req.body.additionalReviewId || isNaN(Number(req.body.additionalReviewId))) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    try {
        let token = req.headers['authorization'];
        token = await util.decodeToken(token, res);

        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const member = await db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        });

        if(!member) {
            res.status(400).json({
                error: 'invalid request'
            });
            return;
        }

        const additionalReview = await db.ProductAdditionalReview.findOne({
            where: {
                index: req.body.additionalReviewId
            }
        });

        if(!additionalReview) {
            res.status(400).json({
                error: 'invalid request'
            });
            return;
        }

        const review = await db.ProductReview.findOne({
            where: {
                index: additionalReview.product_review_index
            }
        });

        if(review.member_info_index !== member.index) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        additionalReview.destroy();

        res.json({
            success: true
        });
    } catch(e) {
        res.status(400).json({
            error: "invalid request"
        });
    }

});

module.exports = router;
