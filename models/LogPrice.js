module.exports = (sequelize, DataTypes) => {
    return sequelize.define('LogPrice', {
        index: {
            type: DataTypes.BIGINT,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        nickName: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: {
                len: [0, 6]
            }
        },
        productId: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },
        category: {
            type: DataTypes.STRING,
            allowNull: false
        },
        subCategory: {
            type: DataTypes.STRING,
            allowNull: false
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        brand: {
            type: DataTypes.STRING,
            allowNull: false
        },
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'log_price'
    })
};