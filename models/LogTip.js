module.exports = (sequelize, DataTypes) => {
    return sequelize.define('LogTip', {
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
        tipId: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
        }
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'log_tip'
    })
};