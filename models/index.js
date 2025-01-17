const config = require('../config/config');

const Sequelize = require('sequelize');
const sequelize = new Sequelize(
    config.databaseName,
    config.databaseID,
    config.databasePassword,
    {
        host: 'localhost',
        dialect: 'mysql',
        pool: {
            max: 20,
            min: 0,
            acquire: 5000,
            idle: 5000
        },
        define: {
            charset: 'utf8',
            dialectOptions: {
                collate: 'utf8_general_ci'
            }
        },
        dialectOptions: {
            useUTC: false,
            dateStrings: true,

            typeCast: function (field, next) {
                if (field.type === 'DATETIME') {
                return field.string()
                }
                return next()
            }
        },
        timezone: '+09:00'
    }
);
const CosmeticIngredient = require('./CosmeticIngredient')(sequelize, Sequelize);
const CosmeticDB = require('./Cosmetic')(sequelize, Sequelize);
const LivingIngredient = require('./LivingIngredient')(sequelize, Sequelize);
const LivingDB = require('./Living')(sequelize, Sequelize);
const MemberInfo = require('./MemberInfo')(sequelize, Sequelize);

CosmeticIngredient.belongsToMany(CosmeticDB, { through: 'cosmetic_ingredient_to_product' });
CosmeticDB.belongsToMany(CosmeticIngredient, { through: 'cosmetic_ingredient_to_product' });
LivingIngredient.belongsToMany(LivingDB, { through: 'living_ingredient_to_product' });
LivingDB.belongsToMany(LivingIngredient, { through: 'living_ingredient_to_product' });

MemberInfo.belongsToMany(MemberInfo, { as: 'follower', foreignKey: 'followee', through: 'follower_to_followee' });
MemberInfo.belongsToMany(MemberInfo, { as: 'followee', foreignKey: 'follower', through: 'follower_to_followee' });

const MemberToHome = require('./MemberToHome')(sequelize, Sequelize);
const MemberToLike = require('./MemberToLike')(sequelize, Sequelize);

const MemberToOpenRequest = require('./MemberToOpenRequest')(sequelize, Sequelize);
const IngredientAnalysis = require('./IngredientAnalysis')(sequelize, Sequelize);
const OneToOneQuestion = require('./OneToOneQuestion')(sequelize, Sequelize);

const HoneyTip = require('./HoneyTip')(sequelize, Sequelize);
const Event = require('./Event')(sequelize, Sequelize);

const Comment = require('./Comment')(sequelize, Sequelize);

HoneyTip.hasMany(Comment);
Event.hasMany(Comment);
MemberInfo.hasMany(Comment);

MemberInfo.belongsToMany(Event, {through: 'member_to_event'});
Event.belongsToMany(MemberInfo, {through: 'member_to_event'});

const ProductReview = require('./ProductReview')(sequelize, Sequelize);
MemberInfo.hasMany(ProductReview);
CosmeticDB.hasMany(ProductReview);
LivingDB.hasMany(ProductReview);

const ProductReviewImage = require('./ProductReviewImage')(sequelize, Sequelize);
ProductReview.hasMany(ProductReviewImage, {
    onDelete: 'cascade'
});

const ProductAdditionalReview = require('./ProductAdditionalReview')(sequelize, Sequelize);
ProductReview.hasMany(ProductAdditionalReview, {
    onDelete: 'cascade'
});

const LikeOrHate = require('./LikeOrHate')(sequelize, Sequelize);

MemberInfo.hasMany(LikeOrHate);
Comment.hasMany(LikeOrHate);
HoneyTip.hasMany(LikeOrHate);
Event.hasMany(LikeOrHate);
ProductReview.hasMany(LikeOrHate);

const Report = require('./Report')(sequelize, Sequelize);

MemberInfo.hasMany(Report);
Comment.hasMany(Report);
ProductReview.hasMany(Report);

const PublicAlarm = require('./PublicAlarm')(sequelize, Sequelize);
const MemberToPublicAlarm = require('./MemberToPublicAlarm')(sequelize, Sequelize);

PublicAlarm.belongsToMany(MemberInfo, {through: MemberToPublicAlarm, onDelete: 'cascade'});
MemberInfo.belongsToMany(PublicAlarm, {through: MemberToPublicAlarm, onDelete: 'cascade'});

const PrivateAlarm = require('./PrivateAlarm')(sequelize, Sequelize);
MemberInfo.hasMany(PrivateAlarm, {onDelete: 'cascade'});

const Faq = require('./Faq')(sequelize, Sequelize);

const Slider = require('./Slider')(sequelize, Sequelize);

const LogEvent = require('./LogEvent')(sequelize, Sequelize);
const LogPrice = require('./LogPrice')(sequelize, Sequelize);
const LogProduct = require('./LogProduct')(sequelize, Sequelize);
const LogSearch = require('./LogSearch')(sequelize, Sequelize);
const LogTip = require('./LogTip')(sequelize, Sequelize);


module.exports = {
    CosmeticIngredient,
    CosmeticDB,
    LivingIngredient,
    LivingDB,
    MemberInfo,
    MemberToHome,
    MemberToLike,
    MemberToOpenRequest,
    IngredientAnalysis,
    OneToOneQuestion,
    HoneyTip,
    Event,
    Comment,
    ProductReview,
    ProductReviewImage,
    ProductAdditionalReview,
    LikeOrHate,
    Report,
    PublicAlarm,
    MemberToPublicAlarm,
    PrivateAlarm,
    Faq,
    Slider,
    LogEvent,
    LogPrice,
    LogProduct,
    LogSearch,
    LogTip,
    sequelize
};